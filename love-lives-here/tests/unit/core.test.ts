import { describe, expect, it } from "vitest";
import { formatNaira, naira } from "@/lib/money";
import { addDays, addWorkingDays, isIsoDate, lagosDayPart, lagosToday } from "@/lib/dates";
import { validatePhone } from "@/lib/phone";
import { canTransition, TRANSITIONS } from "@/lib/order-status";
import { base32Decode, base32Encode, totpAt, verifyTotp } from "@/lib/auth/totp";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/auth/password";
import { signWebhook, verifyWebhookSignature } from "@/lib/paystack";
import { sniff } from "@/lib/media";
import { availability, safeExternalUrl, selectForNow } from "@/lib/nfc";
import { normaliseLines } from "@/lib/pricing";
import { earliestDate } from "@/lib/scheduling";
import { can, canMoveTo } from "@/lib/auth/permissions";
import { checkoutSchema } from "@/lib/validation";
import { sign, verifySigned } from "@/lib/tokens";

describe("money", () => {
  it("stores kobo integers and formats naira", () => {
    expect(naira(10000)).toBe(1_000_000);
    expect(formatNaira(1_000_000)).toBe("₦10,000");
    expect(formatNaira(null)).toBe("—");
  });
});

describe("Lagos business dates (no UTC off-by-one)", () => {
  it("23:30 UTC is already the next day in Lagos", () => {
    expect(lagosToday(new Date("2026-02-12T23:30:00Z"))).toBe("2026-02-13");
    expect(lagosToday(new Date("2026-02-12T22:59:00Z"))).toBe("2026-02-12");
  });
  it("validates ISO dates strictly", () => {
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("28/02/2026")).toBe(false);
  });
  it("adds working days skipping Sundays", () => {
    expect(addWorkingDays("2026-11-20", 2)).toBe("2026-11-23"); // Fri -> Sat, (Sun skipped) Mon
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("day parts use Lagos time", () => {
    expect(lagosDayPart(new Date("2026-01-01T06:00:00Z"))).toBe("morning"); // 07:00 Lagos
    expect(lagosDayPart(new Date("2026-01-01T21:30:00Z"))).toBe("night"); // 22:30 Lagos
  });
  it("earliest date respects lead time, cutoff and closed days", () => {
    const settings = { minLeadDays: 2, cutoffHour: 16, defaultDailyCapacity: null, maxDaysAhead: 180, closedWeekdays: [] };
    // Monday 10:00 Lagos
    expect(earliestDate({ now: new Date("2026-11-16T09:00:00Z"), productionDays: 2, transitDays: 0, settings })).toBe("2026-11-18");
    // Monday 17:00 Lagos — after cutoff, counts from Tuesday
    expect(earliestDate({ now: new Date("2026-11-16T16:00:00Z"), productionDays: 2, transitDays: 0, settings })).toBe("2026-11-19");
    // Interstate transit adds days; closed Sundays push forward
    expect(earliestDate({ now: new Date("2026-11-16T09:00:00Z"), productionDays: 2, transitDays: 4, settings: { ...settings, closedWeekdays: [0] } })).toBe("2026-11-23");
  });
});

describe("phone validation (fixes: original accepted anything non-empty)", () => {
  it.each(["0803 123 4567", "08031234567", "+234 803 123 4567", "2348107134258", "+44 7911 123456"])("accepts %s", (p) => {
    expect(validatePhone(p).ok).toBe(true);
  });
  it.each(["123", "abc", "0803", "080312345678901", "", "+234 123"])("rejects %s", (p) => {
    expect(validatePhone(p).ok).toBe(false);
  });
  it("normalises to E.164", () => {
    const r = validatePhone("0810 713 4258");
    expect(r.ok && r.e164).toBe("+2348107134258");
  });
  it("rider phone must be Nigerian", () => {
    expect(validatePhone("+44 7911 123456", { nigeriaOnly: true }).ok).toBe(false);
  });
});

describe("order lifecycle", () => {
  const ctx = { approvalRequired: true, hasApprovedDraft: false, paymentStatus: "paid" };
  it("staff can never set 'paid' manually", () => {
    for (const from of Object.keys(TRANSITIONS)) expect(TRANSITIONS[from as keyof typeof TRANSITIONS]).not.toContain("paid");
  });
  it("blocks production before approval", () => {
    expect(canTransition("approved", "in_production", ctx).ok).toBe(false);
    expect(canTransition("approved", "in_production", { ...ctx, hasApprovedDraft: true }).ok).toBe(true);
  });
  it("blocks fulfilment on unpaid orders", () => {
    expect(canTransition("on_hold", "in_production", { ...ctx, approvalRequired: false, paymentStatus: "unpaid" }).ok).toBe(false);
  });
  it("paid orders must be refunded, not cancelled", () => {
    expect(canTransition("paid", "cancelled", ctx).ok).toBe(false);
  });
});

describe("roles", () => {
  it("writers can't see addresses or payments; packers can't see letters", () => {
    expect(can("writer", "customers.pii")).toBe(false);
    expect(can("writer", "payments.view")).toBe(false);
    expect(can("fulfilment", "letters.view")).toBe(false);
    expect(can("manager", "staff.manage")).toBe(false);
    expect(can("owner", "staff.manage")).toBe(true);
    expect(canMoveTo("fulfilment", "dispatched")).toBe(true);
    expect(canMoveTo("fulfilment", "approved")).toBe(false);
  });
});

describe("TOTP (RFC 6238 test vector)", () => {
  const secret = base32Encode(Buffer.from("12345678901234567890"));
  it("round-trips base32", () => expect(base32Decode(secret).toString()).toBe("12345678901234567890"));
  it("matches RFC 6238 SHA-1 vector at T=59s", () => expect(totpAt(secret, 1)).toBe("287082"));
  it("accepts ±1 step and rejects others", () => {
    const now = 1_700_000_000_000;
    const step = Math.floor(now / 30000);
    expect(verifyTotp(secret, totpAt(secret, step - 1), now)).toBe(step - 1);
    expect(verifyTotp(secret, totpAt(secret, step + 3), now)).toBeNull();
    expect(verifyTotp(secret, "12345", now)).toBeNull();
  });
});

describe("passwords", () => {
  it("hashes with scrypt and verifies", async () => {
    const h = await hashPassword("correct horse battery");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse battery", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
    expect(passwordProblem("short")).toBeTruthy();
  });
});

describe("Paystack webhook signature", () => {
  it("verifies HMAC-SHA512 and rejects tampering", () => {
    process.env.PAYSTACK_SECRET_KEY = "sk_test_unit";
    const body = JSON.stringify({ event: "charge.success", data: { reference: "x" } });
    const sig = signWebhook(body, "sk_test_unit");
    expect(verifyWebhookSignature(body, sig)).toBe(true);
    expect(verifyWebhookSignature(body.replace("x", "y"), sig)).toBe(false);
    expect(verifyWebhookSignature(body, null)).toBe(false);
    delete process.env.PAYSTACK_SECRET_KEY;
  });
});

describe("upload sniffing", () => {
  it("detects types from bytes, not names", () => {
    expect(sniff(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))?.mime).toBe("image/jpeg");
    expect(sniff(Buffer.from("ID3\x04\0\0\0\0\0\0\0\0", "latin1"))?.kind).toBe("audio");
    expect(sniff(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'>"))).toBeNull();
    expect(sniff(Buffer.from("<html><script>alert(1)</script>"))).toBeNull();
  });
});

describe("Gold Card logic", () => {
  const base = { id: "e", status: "active", startsAt: null, expiresAt: null, accessCodeHash: null } as never;
  it("availability rules", () => {
    expect(availability(null).ok).toBe(false);
    expect(availability({ ...(base as object), status: "draft" } as never).ok).toBe(false);
    expect(availability({ ...(base as object), status: "draft" } as never, new Date(), { preview: true }).ok).toBe(true);
    expect(availability({ ...(base as object), expiresAt: new Date(Date.now() - 1000) } as never)).toEqual({ ok: false, reason: "expired" });
    expect(availability({ ...(base as object), accessCodeHash: "x" } as never)).toEqual({ ok: false, reason: "locked" });
    expect(availability(base).ok).toBe(true);
  });
  it("chooses the note for the time of day, falling back to any-time", () => {
    const mk = (id: string, window: string) => ({ id, kind: "note", window, body: id }) as never;
    const items = [mk("any", "any"), mk("morning", "morning"), mk("night", "night")];
    expect(selectForNow(items, "morning").note).toMatchObject({ id: "morning" });
    expect(selectForNow(items, "afternoon").note).toMatchObject({ id: "any" });
  });
  it("only allows safe https links", () => {
    expect(safeExternalUrl("https://open.spotify.com/x")).toBe("https://open.spotify.com/x");
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalUrl("http://example.com")).toBeNull();
    expect(safeExternalUrl("https://127.0.0.1/admin")).toBeNull();
    expect(safeExternalUrl("https://user:pw@example.com")).toBeNull();
  });
});

describe("cart input normalisation", () => {
  it("merges duplicates, caps quantity, drops junk", () => {
    const id = "11111111-1111-1111-1111-111111111111";
    expect(normaliseLines([{ variantId: id, quantity: 15 }, { variantId: id, quantity: 15 }, { variantId: "x", quantity: 1 }, { variantId: id, quantity: -2 }, null]))
      .toEqual([{ variantId: id, quantity: 20 }]);
    expect(normaliseLines("nope")).toEqual([]);
  });
});

describe("checkout validation", () => {
  it("requires consent, a valid phone and a real email", () => {
    const r = checkoutSchema.safeParse({ checkoutKey: "short", lines: [], buyer: { name: "", phone: "123", email: "x" }, recipient: { name: "" }, delivery: { zoneId: 0, date: "" }, consent: false });
    expect(r.success).toBe(false);
    const paths = r.error!.issues.map((i) => i.path.join("."));
    for (const p of ["buyer.phone", "buyer.email", "consent", "lines", "recipient.name"]) expect(paths).toContain(p);
  });
});

describe("signed values", () => {
  it("verifies and expires", () => {
    const t = sign("abc", 60);
    expect(verifySigned(t)).toBe("abc");
    expect(verifySigned(t.slice(0, -2) + "xx")).toBeNull();
    expect(verifySigned(sign("abc", -1))).toBeNull();
  });
});

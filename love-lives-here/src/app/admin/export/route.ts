import { NextResponse } from "next/server";
import { getStaff } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { listOrders } from "@/lib/admin-orders";
import { audit } from "@/lib/audit";
import { ip } from "@/lib/http";

const esc = (v: unknown) => {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // CSV/formula injection guard
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV of orders (no letter content). Owner/manager only; every export is audited. */
export async function GET(req: Request) {
  const s = await getStaff();
  if (!s || (s.totpEnabled && !s.mfaPassed) || !can(s.role, "orders.export")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const f = Object.fromEntries(new URL(req.url).searchParams);
  const rows = await listOrders({ ...f, staffId: s.id }, 5000);
  const head = ["number", "created_at", "status", "payment_status", "delivery_date", "zone", "subtotal_ngn", "delivery_fee_ngn", "total_ngn", "buyer_name", "buyer_phone", "buyer_email", "recipient_name", "source", "test_mode"];
  const lines = rows.map((o) => [o.number, o.createdAt.toISOString(), o.status, o.paymentStatus, o.deliveryDate, o.zoneName, o.subtotal / 100, o.deliveryFee == null ? "" : o.deliveryFee / 100, o.total == null ? "" : o.total / 100, o.buyerName, o.buyerPhone, o.buyerEmail, o.recipientName, o.source?.source ?? "", o.testMode].map(esc).join(","));
  await audit({ actorId: s.id, actorEmail: s.email, action: "orders.export", entity: "orders", meta: { count: rows.length, filters: f }, ip: await ip() });
  return new NextResponse([head.join(","), ...lines].join("\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="llh-orders-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" },
  });
}

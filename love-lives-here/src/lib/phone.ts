import { parsePhoneNumberFromString } from "libphonenumber-js/max";

export type PhoneResult = { ok: true; e164: string; national: string } | { ok: false; error: string };

/**
 * Validates a phone number. Nigerian numbers may be typed in local form
 * (0801 234 5678); buyers abroad may enter an international number with +.
 * Rejects things the original site accepted, such as "123" or "abc".
 */
export function validatePhone(input: string, opts: { nigeriaOnly?: boolean } = {}): PhoneResult {
  const raw = (input ?? "").trim();
  if (!raw) return { ok: false, error: "Enter a phone number." };
  if (!/^[+\d][\d\s().-]{6,20}$/.test(raw)) return { ok: false, error: "Use digits only, like 0801 234 5678." };
  const p = parsePhoneNumberFromString(raw, "NG");
  if (!p || !p.isValid()) return { ok: false, error: "That doesn't look like a valid phone number. Try 0801 234 5678 or +44…" };
  if (opts.nigeriaOnly && p.country !== "NG") return { ok: false, error: "Enter a Nigerian number for the rider, like 0801 234 5678." };
  return { ok: true, e164: p.number, national: p.formatNational() };
}

export { waLink } from "./wa";

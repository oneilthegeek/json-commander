/** Money helpers. All amounts are integer kobo. */
export const KOBO = 100;

export function naira(n: number): number {
  return Math.round(n * KOBO);
}

export function formatNaira(kobo: number | null | undefined): string {
  if (kobo == null) return "—";
  const whole = kobo / KOBO;
  return "₦" + whole.toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: Number.isInteger(whole) ? 0 : 2 });
}

export function assertKobo(n: number): number {
  if (!Number.isInteger(n) || n < 0) throw new Error(`Invalid amount: ${n}`);
  return n;
}

"use client";
import { useEffect, useRef, useState } from "react";
import type { CartLine } from "./cart";

export type Quote = {
  lines: { variantId: string; productName: string; variantName: string; unitPrice: number; quantity: number; lineTotal: number; kind: string; nfc: string | null }[];
  subtotal: number;
  delivery: { mode: "fixed" | "quote" | "pickup"; zoneId: number; zoneName: string; fee: number | null } | null;
  total: number | null;
  needsLetterBrief: boolean;
  approvalRequired: boolean;
  earliestDate: string;
  errors: { variantId?: string; message: string }[];
};

/**
 * Asks the server for the authoritative price of the bag. Re-runs immediately
 * whenever an item, quantity or delivery area changes — so the total shown is
 * always the one we'll charge (fixes the stale-total bug in the old site).
 */
export function useQuote(lines: CartLine[], zoneId: number | null, ready = true) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const key = JSON.stringify([lines.map((l) => [l.variantId, l.quantity]), zoneId]);

  useEffect(() => {
    if (!ready) return;
    const my = ++seq.current;
    setLoading(true);
    const ctrl = new AbortController();
    fetch("/api/cart/quote", {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal,
      body: JSON.stringify({ lines: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })), zoneId }),
    })
      .then(async (r) => {
        const data = await r.json();
        if (my !== seq.current) return;
        if (!r.ok) { setError(data.error ?? "Couldn't update prices."); return; }
        setQuote(data); setError(null);
      })
      .catch((e) => { if (e.name !== "AbortError" && my === seq.current) setError("Couldn't reach the server to update prices. Check your connection."); })
      .finally(() => { if (my === seq.current) setLoading(false); });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready]);

  return { quote, loading, error };
}

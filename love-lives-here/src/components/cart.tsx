"use client";
/**
 * The bag lives in the browser (like any shop) but holds only IDs and
 * quantities plus display hints. Every price shown at checkout comes from the
 * server's /api/cart/quote, and the order itself is created server-side.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { track } from "./track";

export type CartLine = {
  variantId: string;
  quantity: number;
  productSlug: string;
  productName: string;
  variantName: string;
  kind: string;
  image?: string | null;
  unitPrice: number; // display hint only (kobo)
};

export type LetterDraft = Record<string, string> & { mode?: "own_words" | "help_me" };

type CartState = { lines: CartLine[]; letter: LetterDraft | null; giftNote: string };
type Ctx = CartState & {
  ready: boolean;
  count: number;
  add: (l: CartLine) => void;
  setQty: (variantId: string, q: number) => void;
  remove: (variantId: string) => void;
  setLetter: (l: LetterDraft | null) => void;
  setGiftNote: (s: string) => void;
  clear: () => void;
  announce: string;
};

const KEY = "llh-bag-v1";
const CartCtx = createContext<Ctx | null>(null);
export const MAX_QTY = 20;

function load(): CartState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as CartState;
      if (Array.isArray(s.lines)) return { lines: s.lines.slice(0, 30), letter: s.letter ?? null, giftNote: s.giftNote ?? "" };
    }
  } catch { /* storage unavailable */ }
  return { lines: [], letter: null, giftNote: "" };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CartState>({ lines: [], letter: null, giftNote: "" });
  const [ready, setReady] = useState(false);
  const [announce, setAnnounce] = useState("");

  useEffect(() => { setState(load()); setReady(true); }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }, [state, ready]);
  // Keep tabs in sync
  useEffect(() => {
    const on = (e: StorageEvent) => { if (e.key === KEY) setState(load()); };
    window.addEventListener("storage", on);
    return () => window.removeEventListener("storage", on);
  }, []);

  const add = useCallback((l: CartLine) => {
    setState((s) => {
      const max = l.kind === "letter" ? 1 : MAX_QTY;
      const found = s.lines.find((x) => x.variantId === l.variantId);
      const lines = found
        ? s.lines.map((x) => (x.variantId === l.variantId ? { ...x, ...l, quantity: Math.min(max, x.quantity + l.quantity) } : x))
        : [...s.lines, { ...l, quantity: Math.min(max, l.quantity) }];
      return { ...s, lines };
    });
    setAnnounce(`${l.productName}, ${l.variantName} added to your bag.`);
    track("add_to_cart", { product: l.productSlug, value: l.unitPrice * l.quantity });
  }, []);

  const setQty = useCallback((variantId: string, q: number) => {
    setState((s) => ({
      ...s,
      lines: s.lines.map((x) => (x.variantId === variantId ? { ...x, quantity: Math.max(1, Math.min(x.kind === "letter" ? 1 : MAX_QTY, q)) } : x)),
    }));
  }, []);

  const remove = useCallback((variantId: string) => {
    setState((s) => {
      const gone = s.lines.find((x) => x.variantId === variantId);
      if (gone) { setAnnounce(`${gone.productName} removed from your bag.`); track("remove_from_cart", { product: gone.productSlug }); }
      const lines = s.lines.filter((x) => x.variantId !== variantId);
      return { ...s, lines, letter: lines.some((x) => x.kind === "letter") ? s.letter : null };
    });
  }, []);

  const value = useMemo<Ctx>(() => ({
    ...state, ready, announce,
    count: state.lines.reduce((n, l) => n + l.quantity, 0),
    add, setQty, remove,
    setLetter: (letter) => setState((s) => ({ ...s, letter })),
    setGiftNote: (giftNote) => setState((s) => ({ ...s, giftNote })),
    clear: () => setState({ lines: [], letter: null, giftNote: "" }),
  }), [state, ready, announce, add, setQty, remove]);

  return (
    <CartCtx.Provider value={value}>
      {children}
      <div className="sr-only" role="status" aria-live="polite">{announce}</div>
    </CartCtx.Provider>
  );
}

export function useCart() {
  const c = useContext(CartCtx);
  if (!c) throw new Error("useCart outside CartProvider");
  return c;
}

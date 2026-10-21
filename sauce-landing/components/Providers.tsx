"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

type CartCtx = { count: number; last: string | null; add: (name: string) => void };
const Cart = createContext<CartCtx>({ count: 0, last: null, add: () => {} });
export const useCart = () => useContext(Cart);

let lenisInstance: Lenis | null = null;
export const scrollToId = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  if (lenisInstance) lenisInstance.scrollTo(el, { duration: 1.6 });
  else el.scrollIntoView({ behavior: "smooth" });
};

export default function Providers({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);
  const [last, setLast] = useState<string | null>(null);
  const add = useCallback((name: string) => {
    setCount((c) => c + 1);
    setLast(name);
  }, []);

  // Lenis smooth scroll driven by GSAP's ticker so ScrollTrigger stays in sync
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1 });
    lenisInstance = lenis;
    lenis.on("scroll", ScrollTrigger.update);
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
      lenisInstance = null;
    };
  }, []);

  return <Cart.Provider value={{ count, last, add }}>{children}</Cart.Provider>;
}

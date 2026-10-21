"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import { scrollToId, useCart } from "./Providers";
import Magnetic from "./Magnetic";

const links = [
  { id: "story", label: "Story" },
  { id: "shop", label: "Shop" },
  { id: "flavors", label: "Flavours" },
  { id: "ingredients", label: "Ingredients" },
];

export default function Nav() {
  const { count, last } = useCart();
  const { scrollY } = useScroll();
  const [hidden, setHidden] = useState(false);
  const [solid, setSolid] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useMotionValueEvent(scrollY, "change", (v) => {
    const prev = scrollY.getPrevious() ?? 0;
    setHidden(v > prev && v > 400);
    setSolid(v > 60);
  });

  useEffect(() => {
    if (!last) return;
    setToast(last);
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [last, count]);

  return (
    <>
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: hidden ? -100 : 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="fixed inset-x-0 top-0 z-50"
      >
        <div
          className={`container-x flex items-center justify-between py-5 transition-colors duration-500 ${
            solid ? "bg-char/70 backdrop-blur-md" : ""
          }`}
        >
          <button onClick={() => scrollToId("top")} className="flex items-baseline gap-1.5" data-cursor="Top">
            <span className="font-display text-2xl uppercase tracking-tight text-ember">Fuego</span>
            <span className="font-serif text-2xl italic text-bone">Noir</span>
          </button>

          <nav className="hidden items-center gap-10 md:flex">
            {links.map((l) => (
              <button
                key={l.id}
                onClick={() => scrollToId(l.id)}
                className="group relative eyebrow text-bone/80 transition-colors hover:text-bone"
              >
                {l.label}
                <span className="absolute -bottom-1.5 left-0 h-px w-full origin-right scale-x-0 bg-ember transition-transform duration-500 group-hover:origin-left group-hover:scale-x-100" />
              </button>
            ))}
          </nav>

          <Magnetic>
            <button
              onClick={() => scrollToId("shop")}
              className="relative flex items-center gap-3 rounded-full border border-bone/20 px-5 py-2.5 eyebrow transition-colors hover:border-ember hover:bg-ember hover:text-char"
            >
              Cart
              <span className="relative flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-ember text-char">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={count}
                    initial={{ y: 14, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -14, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 24 }}
                    className="text-[11px] font-bold tracking-normal"
                  >
                    {count}
                  </motion.span>
                </AnimatePresence>
              </span>
            </button>
          </Magnetic>
        </div>
      </motion.header>

      <AnimatePresence>
        {toast && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-ember px-6 py-3 text-sm font-semibold text-char shadow-[0_20px_60px_-10px_rgba(255,91,0,0.6)]"
          >
            🔥 {toast} added to cart
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

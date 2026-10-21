"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Magnetic from "../Magnetic";
import { scrollToId } from "../Providers";

export default function Cta() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <section id="cta" data-jar="cta" className="relative flex min-h-[110svh] items-center overflow-hidden py-24">
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 flex flex-col items-center justify-center select-none">
        <span className="font-display text-[24vw] uppercase leading-[0.8] text-ember md:text-[19vw]">Taste</span>
        <span className="font-display text-[24vw] uppercase leading-[0.8] text-outline md:text-[19vw]">The dark</span>
      </div>

      <div className="container-x relative z-20 flex min-h-[90svh] flex-col justify-between">
        <div className="flex justify-between">
          <span className="eyebrow text-bone/60">Batch 24-117 · 300 jars</span>
          <span className="eyebrow text-bone/60">Ships in 48h</span>
        </div>

        <div className="grid items-end gap-10 md:grid-cols-2">
          <div>
            <p className="max-w-sm font-serif text-3xl italic leading-tight md:text-4xl">
              Join the Ember Club for first access to every numbered batch.
            </p>
            <form
              className="mt-6 flex max-w-md items-center gap-2 rounded-full border border-bone/20 bg-char/60 p-1.5 backdrop-blur focus-within:border-ember"
              onSubmit={(e) => {
                e.preventDefault();
                if (email.includes("@")) setSent(true);
              }}
            >
              <label htmlFor="email" className="sr-only">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm text-bone placeholder:text-bone/40 focus:outline-none"
                disabled={sent}
              />
              <button type="submit" className="relative h-11 min-w-[120px] overflow-hidden rounded-full bg-ember px-5 text-sm font-semibold text-char">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={sent ? "s" : "j"}
                    initial={{ y: 18, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -18, opacity: 0 }}
                    className="block"
                  >
                    {sent ? "You're in 🔥" : "Join"}
                  </motion.span>
                </AnimatePresence>
              </button>
            </form>
          </div>
          <div className="flex md:justify-end">
            <Magnetic strength={0.4}>
              <button
                onClick={() => scrollToId("shop")}
                data-cursor="Shop"
                className="group flex h-40 w-40 items-center justify-center rounded-full bg-ember text-center font-display text-2xl uppercase leading-none text-char transition-transform duration-500 hover:scale-110 md:h-52 md:w-52 md:text-3xl"
              >
                Shop <br /> now
              </button>
            </Magnetic>
          </div>
        </div>
      </div>
    </section>
  );
}

"use client";

import { motion } from "framer-motion";
import Magnetic from "../Magnetic";
import { scrollToId } from "../Providers";

const ease = [0.16, 1, 0.3, 1] as const;
const intro = 2.1; // after the loader lifts

function Line({ children, delay, className }: { children: React.ReactNode; delay: number; className?: string }) {
  return (
    <span className="block overflow-hidden pb-[0.04em]">
      <motion.span
        className={`block ${className ?? ""}`}
        initial={{ y: "105%" }}
        animate={{ y: "0%" }}
        transition={{ duration: 1.2, ease, delay: intro + delay }}
      >
        {children}
      </motion.span>
    </span>
  );
}

export default function Hero() {
  return (
    <section id="top" data-jar="hero" className="relative min-h-[100svh] overflow-hidden">
      {/* no z-index here: the wordmark (z-0) must sit behind the canvas, the copy (z-20) above it */}
      <div className="container-x relative flex min-h-[100svh] flex-col pb-8 pt-28 md:pb-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease, delay: intro + 0.4 }}
          className="relative z-20 flex items-center gap-4"
        >
          <span className="h-px w-10 bg-ember" />
          <span className="eyebrow text-bone/70">Small-batch gourmet sauce · Est. 2019</span>
        </motion.div>

        <h1 className="relative z-0 mt-6 select-none font-display uppercase leading-[0.85] tracking-tight md:mt-4">
          <span className="sr-only">Fuego Noir gourmet sauce</span>
          <span aria-hidden className="flex flex-wrap gap-x-[0.18em] text-[24vw] md:text-[min(18.5vw,40vh)]">
            <Line delay={0} className="text-ember">
              Fuego
            </Line>
            <Line delay={0.1} className="text-outline">
              Noir
            </Line>
          </span>
        </h1>

        <motion.div
          className="relative z-20 mt-8 max-w-xl md:mt-auto"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease, delay: intro + 0.55 }}
        >
          <p className="font-serif text-4xl italic leading-[1.05] text-bone md:text-5xl">
            Crafted in the dark. <span className="text-ember">Made to ignite.</span>
          </p>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-bone/60 md:text-base">
            Oak-smoked chillies, fermented for ninety days, bottled by hand in batches of 300. Sauces with
            the depth of a fine wine and the bite of an open flame.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-4">
            <Magnetic>
              <button
                onClick={() => scrollToId("shop")}
                data-cursor="Shop"
                className="group relative overflow-hidden rounded-full bg-ember px-8 py-4 font-semibold text-char"
              >
                <span className="relative z-10 flex items-center gap-3">
                  Shop the collection
                  <span className="transition-transform duration-500 group-hover:translate-x-1">→</span>
                </span>
                <span className="absolute inset-0 translate-y-full rounded-full bg-bone transition-transform duration-500 ease-[cubic-bezier(.16,1,.3,1)] group-hover:translate-y-0" />
              </button>
            </Magnetic>
            <button
              onClick={() => scrollToId("story")}
              className="rounded-full border border-bone/25 px-7 py-4 text-sm font-medium text-bone transition-colors hover:border-ember hover:text-ember"
            >
              Our story
            </button>
          </div>
        </motion.div>

        <motion.div
          className="relative z-20 mt-10 flex items-end justify-between gap-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: intro + 0.9 }}
        >
          <span className="eyebrow hidden items-center gap-3 text-bone/50 sm:flex">
            <span className="relative h-10 w-[1px] overflow-hidden bg-bone/15">
              <motion.span
                className="absolute inset-x-0 top-0 h-1/2 bg-ember"
                animate={{ y: ["-100%", "200%"] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              />
            </span>
            Scroll to ignite
          </span>
          <dl className="flex gap-8 md:gap-12">
            {[
              ["14h", "Oak smoked"],
              ["90d", "Fermented"],
              ["0", "Shortcuts"],
            ].map(([v, l]) => (
              <div key={l} className="border-t border-bone/15 pt-2">
                <dt className="font-display text-3xl text-bone md:text-4xl">{v}</dt>
                <dd className="eyebrow mt-1 text-[10px] text-bone/50">{l}</dd>
              </div>
            ))}
          </dl>
        </motion.div>
      </div>
    </section>
  );
}

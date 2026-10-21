"use client";

import { motion } from "framer-motion";
import Magnetic from "../Magnetic";
import { scrollToId } from "../Providers";

const ease = [0.16, 1, 0.3, 1] as const;
const intro = 2.1; // after the loader lifts

function Line({ children, delay, className }: { children: React.ReactNode; delay: number; className?: string }) {
  return (
    <span className="block overflow-hidden">
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
      {/* oversized wordmark sits BEHIND the 3D canvas */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 flex flex-col justify-center select-none">
        <h1 className="sr-only">Fuego Noir gourmet sauce</h1>
        <div className="container-x font-display uppercase leading-[0.82] tracking-tight">
          <Line delay={0} className="text-[27vw] text-ember md:text-[23vw]">
            Fuego
          </Line>
          <Line delay={0.1} className="text-right text-[27vw] text-outline md:text-[23vw]">
            Noir
          </Line>
        </div>
      </div>

      {/* foreground copy above the canvas */}
      <div className="container-x relative z-20 flex min-h-[100svh] flex-col justify-between pb-8 pt-28 md:pb-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease, delay: intro + 0.4 }}
          className="flex items-center gap-4"
        >
          <span className="h-px w-10 bg-ember" />
          <span className="eyebrow text-bone/70">Small-batch gourmet sauce · Est. 2019</span>
        </motion.div>

        <div className="grid items-end gap-10 md:grid-cols-12">
          <motion.div
            className="md:col-span-5"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, ease, delay: intro + 0.55 }}
          >
            <p className="font-serif text-4xl italic leading-[1.05] text-bone md:text-6xl">
              Crafted in the dark.
              <br />
              <span className="text-ember">Made to ignite.</span>
            </p>
            <p className="mt-6 max-w-md text-sm leading-relaxed text-bone/60 md:text-base">
              Oak-smoked chillies, fermented for ninety days, bottled by hand in batches of 300. Sauces with
              the depth of a fine wine and the bite of an open flame.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
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

          <motion.dl
            className="grid grid-cols-3 gap-6 md:col-span-4 md:col-start-9"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: intro + 0.9 }}
          >
            {[
              ["14h", "Oak smoked"],
              ["90d", "Fermented"],
              ["0", "Shortcuts"],
            ].map(([v, l]) => (
              <div key={l} className="border-t border-bone/15 pt-3">
                <dt className="font-display text-4xl text-bone md:text-5xl">{v}</dt>
                <dd className="eyebrow mt-1 text-[10px] text-bone/50">{l}</dd>
              </div>
            ))}
          </motion.dl>
        </div>

        <motion.div
          className="mt-10 flex items-center justify-between"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: intro + 1.1 }}
        >
          <span className="eyebrow flex items-center gap-3 text-bone/50">
            <span className="relative h-10 w-[1px] overflow-hidden bg-bone/15">
              <motion.span
                className="absolute inset-x-0 top-0 h-1/2 bg-ember"
                animate={{ y: ["-100%", "200%"] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              />
            </span>
            Scroll to ignite
          </span>
          <span className="eyebrow hidden text-bone/50 md:block">Drag your cursor · the flame follows</span>
        </motion.div>
      </div>
    </section>
  );
}

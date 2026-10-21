"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { flavors } from "@/lib/data";
import { flavorState, jarState } from "@/lib/jarState";
import RevealText from "../RevealText";

export default function Flavors() {
  const [active, setActive] = useState(0);
  const f = flavors[active];

  const select = (i: number) => {
    setActive(i);
    flavorState.index = i;
    flavorState.color = flavors[i].color;
    // a quick flare of heat on the 3D scene when switching
    jarState.heat = 1.6;
    setTimeout(() => (jarState.heat = 1), 500);
  };

  return (
    <section id="flavors" data-jar="flavors" className="relative overflow-hidden py-28 md:py-40">
      {/* giant flavour word behind the canvas */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 z-0 -translate-y-1/2 select-none">
        <AnimatePresence mode="wait">
          <motion.div
            key={f.id}
            initial={{ opacity: 0, y: 80 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -80 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="text-center font-display text-[34vw] uppercase leading-none text-outline-ember opacity-40"
          >
            {f.name}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="container-x relative z-20 grid grid-cols-12 gap-y-10">
        <div className="col-span-12 md:col-span-6 md:col-start-7">
          <span className="eyebrow text-ember">Flavour profiles</span>
          <RevealText
            as="h2"
            text="Pick your poison."
            className="mt-4 block font-display text-[15vw] uppercase leading-[0.9] md:text-[7vw]"
          />

          <div role="tablist" aria-label="Flavours" className="mt-10 inline-flex rounded-full border border-bone/15 bg-char/50 p-1.5 backdrop-blur">
            {flavors.map((fl, i) => (
              <button
                key={fl.id}
                role="tab"
                aria-selected={i === active}
                onClick={() => select(i)}
                className={`relative rounded-full px-6 py-3 text-sm font-semibold transition-colors md:px-8 ${
                  i === active ? "text-char" : "text-bone/70 hover:text-bone"
                }`}
              >
                {i === active && (
                  <motion.span
                    layoutId="flavor-pill"
                    className="absolute inset-0 rounded-full bg-ember"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative">{fl.name}</span>
              </button>
            ))}
          </div>

          <div className="relative mt-10 min-h-[340px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={f.id}
                initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -16, filter: "blur(8px)" }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                <p className="eyebrow text-bone/50">{f.kicker}</p>
                <p className="mt-4 max-w-xl font-serif text-2xl leading-snug text-bone md:text-3xl">{f.body}</p>
                <div className="mt-10 grid max-w-xl gap-5">
                  {f.profile.map((p, i) => (
                    <div key={p.label}>
                      <div className="mb-2 flex justify-between eyebrow text-bone/60">
                        <span>{p.label}</span>
                        <span className="text-bone">{p.value}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-bone/10">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-ember-700 via-ember to-ember-200"
                          initial={{ width: 0 }}
                          animate={{ width: `${p.value}%` }}
                          transition={{ duration: 1.1, delay: 0.1 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

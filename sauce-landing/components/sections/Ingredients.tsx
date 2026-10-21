"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ingredients } from "@/lib/data";
import IngredientGlyph from "../IngredientGlyph";
import RevealText from "../RevealText";

export default function Ingredients() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const x = useTransform(scrollYProgress, [0, 1], ["10%", "-30%"]);

  return (
    <section ref={ref} id="ingredients" className="paper relative z-20 overflow-hidden bg-ember py-28 text-char md:py-40">
      <motion.div
        aria-hidden
        style={{ x }}
        className="pointer-events-none whitespace-nowrap font-display text-[20vw] uppercase leading-none text-outline-char opacity-30"
      >
        Nothing to hide · Nothing to hide
      </motion.div>

      <div className="container-x relative -mt-[8vw]">
        <div className="grid gap-8 md:grid-cols-12">
          <div className="md:col-span-5">
            <span className="eyebrow">Ingredients</span>
            <RevealText
              as="h2"
              text="Six ingredients. Zero compromise."
              className="mt-4 block font-display text-6xl uppercase leading-[0.9] md:text-8xl"
            />
          </div>
          <p className="max-w-md self-end text-lg leading-relaxed text-char/75 md:col-span-4 md:col-start-9">
            No gums, no extracts, no &ldquo;natural flavourings&rdquo;. Just whole ingredients sourced from the
            growers who know them best.
          </p>
        </div>

        <ul className="mt-16 grid border-l border-t border-char/25 sm:grid-cols-2 lg:grid-cols-3">
          {ingredients.map((ing, i) => (
            <motion.li
              key={ing.name}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10%" }}
              transition={{ duration: 0.8, delay: (i % 3) * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="group relative overflow-hidden border-b border-r border-char/25"
              data-cursor="Taste"
            >
              <div className="absolute inset-0 origin-bottom scale-y-0 bg-char transition-transform duration-700 ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-y-100" />
              <div className="relative flex min-h-[300px] flex-col justify-between p-8 transition-colors duration-500 group-hover:text-bone md:min-h-[340px] md:p-10">
                <div className="flex items-start justify-between">
                  <span className="eyebrow opacity-60">0{i + 1}</span>
                  <IngredientGlyph
                    glyph={ing.glyph}
                    className="h-16 w-16 transition-all duration-700 group-hover:rotate-[-12deg] group-hover:scale-125 group-hover:text-ember"
                  />
                </div>
                <div>
                  <h3 className="font-display text-5xl uppercase leading-none md:text-6xl">{ing.name}</h3>
                  <p className="eyebrow mt-3 opacity-60">{ing.origin}</p>
                  <p className="mt-4 max-w-xs translate-y-4 text-sm leading-relaxed opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-80 max-lg:translate-y-0 max-lg:opacity-70">
                    {ing.fact}
                  </p>
                </div>
              </div>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}

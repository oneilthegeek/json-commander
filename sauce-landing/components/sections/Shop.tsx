"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { products, type Product } from "@/lib/data";
import JarIllustration from "../JarIllustration";
import { useCart } from "../Providers";

gsap.registerPlugin(ScrollTrigger);

function Heat({ level }: { level: number }) {
  return (
    <div className="flex gap-1" aria-label={`Heat ${level} of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} viewBox="0 0 24 24" className={`h-4 w-4 ${i < level ? "text-ember" : "text-bone/15"}`}>
          <path fill="currentColor" d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-6 1-10z" />
        </svg>
      ))}
    </div>
  );
}

function ProductCard({ p, index }: { p: Product; index: number }) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rotX = useSpring(useTransform(my, [0, 1], [8, -8]), { stiffness: 150, damping: 15 });
  const rotY = useSpring(useTransform(mx, [0, 1], [-10, 10]), { stiffness: 150, damping: 15 });
  const jarX = useSpring(useTransform(mx, [0, 1], [-14, 14]), { stiffness: 150, damping: 15 });
  const glare = useTransform([mx, my], ([x, y]: number[]) => `radial-gradient(400px circle at ${x * 100}% ${y * 100}%, ${p.accent}33, transparent 50%)`);

  return (
    <motion.article
      className="group relative flex h-[68svh] max-h-[620px] w-[78vw] shrink-0 flex-col overflow-hidden rounded-[28px] bg-char p-6 text-bone sm:w-[420px] md:p-8"
      style={{ rotateX: rotX, rotateY: rotY, transformPerspective: 1000 }}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width);
        my.set((e.clientY - r.top) / r.height);
      }}
      onPointerLeave={() => {
        mx.set(0.5);
        my.set(0.5);
      }}
      data-cursor="View"
    >
      <motion.div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: glare }} />
      <div
        aria-hidden
        className="absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-40 blur-3xl transition-opacity duration-700 group-hover:opacity-80"
        style={{ background: p.color }}
      />
      <div className="relative flex items-start justify-between">
        <span className="eyebrow text-bone/40">No. 00{index + 1}</span>
        <Heat level={p.heat} />
      </div>

      <motion.div className="relative mx-auto my-4 h-[40%] w-[60%] flex-1" style={{ x: jarX }}>
        <div className="h-full w-full transition-transform duration-700 ease-[cubic-bezier(.16,1,.3,1)] group-hover:-translate-y-3 group-hover:rotate-[-4deg] group-hover:scale-105">
          <JarIllustration color={p.color} accent={p.accent} name={p.name.split(" ")[0]} />
        </div>
      </motion.div>

      <div className="relative">
        <div className="mb-3 flex flex-wrap gap-2">
          {p.notes.map((n) => (
            <span key={n} className="rounded-full border border-bone/15 px-3 py-1 text-[11px] text-bone/60">
              {n}
            </span>
          ))}
        </div>
        <h3 className="font-display text-4xl uppercase leading-none md:text-5xl">{p.name}</h3>
        <p className="mt-2 text-sm text-bone/55">{p.tagline}</p>
        <div className="mt-6 flex items-center justify-between">
          <div>
            <span className="font-display text-3xl">${p.price}</span>
            <span className="ml-2 text-xs text-bone/40">{p.size}</span>
          </div>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => {
              add(p.name);
              setAdded(true);
              setTimeout(() => setAdded(false), 1600);
            }}
            data-cursor="Add"
            className="relative h-12 min-w-[136px] overflow-hidden whitespace-nowrap rounded-full bg-ember px-6 text-sm font-semibold text-char transition-colors hover:bg-ember-300"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={added ? "y" : "n"}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="block"
              >
                {added ? "Added ✓" : "Add to cart"}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        </div>
      </div>
    </motion.article>
  );
}

/** Horizontal product rail scrubbed by vertical scroll. */
export default function Shop() {
  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.to(track.current, {
        x: () => -(track.current!.scrollWidth - window.innerWidth),
        ease: "none",
        scrollTrigger: {
          trigger: root.current,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.6,
          invalidateOnRefresh: true,
        },
      });
      gsap.fromTo(
        "[data-shop-title]",
        { xPercent: 0 },
        { xPercent: -25, ease: "none", scrollTrigger: { trigger: root.current, start: "top bottom", end: "bottom top", scrub: true } },
      );
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={root} id="shop" data-jar="shop" className="paper relative z-20 h-[300vh] bg-bone text-char">
      <div className="sticky top-0 flex h-[100svh] flex-col justify-center overflow-hidden">
        <div className="pointer-events-none absolute left-0 top-[8%] whitespace-nowrap font-display text-[22vw] uppercase leading-none text-char/[0.06]" data-shop-title>
          The Collection — The Collection
        </div>

        <div ref={track} className="relative flex items-center gap-6 pl-5 pr-[10vw] md:gap-10 md:pl-10">
          <div className="flex w-[80vw] shrink-0 flex-col justify-center sm:w-[440px] md:w-[520px]">
            <span className="eyebrow text-ember-700">The Collection</span>
            <h2 className="mt-4 font-display text-[18vw] uppercase leading-[0.85] tracking-tight md:text-[8.5vw]">
              Four ways <br />
              to <span className="font-serif normal-case italic text-ember">burn.</span>
            </h2>
            <p className="mt-6 max-w-sm text-char/70">
              From honeyed warmth to ghost-pepper ferocity. Every bottle numbered, every batch tasted by the
              people who made it.
            </p>
            <p className="eyebrow mt-10 flex items-center gap-3 text-char/50">
              Keep scrolling <span className="inline-block h-px w-12 bg-char/40" /> →
            </p>
          </div>
          {products.map((p, i) => (
            <ProductCard key={p.id} p={p} index={i} />
          ))}
          <div className="flex w-[70vw] shrink-0 flex-col items-start justify-center sm:w-[360px]">
            <span className="font-display text-7xl uppercase leading-[0.9] md:text-8xl">
              The <br /> Trinity <br /> Box
            </span>
            <p className="mt-4 max-w-xs text-char/70">Noir Ember, Solar Flare & Obsidian in a hand-stamped gift crate.</p>
            <span className="mt-6 font-display text-4xl text-ember">$49</span>
          </div>
        </div>
      </div>
    </section>
  );
}

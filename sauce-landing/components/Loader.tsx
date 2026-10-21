"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, animate, motion } from "framer-motion";

/** Short branded intro: a counter fills, then the curtain lifts. */
export default function Loader() {
  const [n, setN] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const controls = animate(0, 100, {
      duration: 1.8,
      ease: [0.65, 0, 0.35, 1],
      onUpdate: (v) => setN(Math.round(v)),
      onComplete: () => setTimeout(() => setDone(true), 200),
    });
    return () => controls.stop();
  }, []);

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          className="fixed inset-0 z-[200] flex flex-col justify-between bg-ember p-6 text-char md:p-10"
          exit={{ clipPath: "inset(0 0 100% 0)" }}
          initial={{ clipPath: "inset(0 0 0% 0)" }}
          transition={{ duration: 1, ease: [0.76, 0, 0.24, 1] }}
        >
          <div className="flex justify-between eyebrow">
            <span>Fuego Noir</span>
            <span>Igniting</span>
          </div>
          <div className="flex items-end justify-between">
            <span className="font-serif text-3xl italic md:text-5xl">Fire within.</span>
            <span className="font-display text-[28vw] leading-[0.8] md:text-[18vw]">{n}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

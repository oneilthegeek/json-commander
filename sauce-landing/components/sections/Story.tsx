"use client";

import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const chapters = [
  {
    n: "01",
    kicker: "The Harvest",
    title: "Picked at peak blush.",
    body: "Our habaneros are grown by a single family farm in the Yucatán and harvested by hand the morning they turn fully ripe — never a day before.",
  },
  {
    n: "02",
    kicker: "The Smoke",
    title: "Fourteen hours over oak.",
    body: "Whole chillies are cold-smoked over white oak until the skins blister and blacken, locking in a deep, campfire sweetness no extract can fake.",
  },
  {
    n: "03",
    kicker: "The Patience",
    title: "Ninety days in the dark.",
    body: "Then we wait. A slow lacto-ferment in clay crocks builds layers of tang and umami, before every jar is filled, sealed and numbered by hand.",
  },
];

/**
 * Scroll-driven storytelling: a tall section with a sticky stage. GSAP
 * scrubs through the three chapters while the jar turns beside them.
 */
export default function Story() {
  const root = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const items = gsap.utils.toArray<HTMLElement>("[data-chapter]");
      const nums = gsap.utils.toArray<HTMLElement>("[data-num]");
      gsap.set(items.slice(1), { autoAlpha: 0, yPercent: 30 });
      gsap.set(nums.slice(1), { yPercent: 100 });

      const tl = gsap.timeline({
        scrollTrigger: { trigger: root.current, start: "top top", end: "bottom bottom", scrub: 0.8 },
      });
      items.forEach((el, i) => {
        if (i === 0) return;
        tl.to(items[i - 1], { autoAlpha: 0, yPercent: -30, duration: 1 }, i * 2 - 1)
          .to(nums[i - 1], { yPercent: -100, duration: 1 }, i * 2 - 1)
          .to(el, { autoAlpha: 1, yPercent: 0, duration: 1 }, i * 2 - 0.6)
          .to(nums[i], { yPercent: 0, duration: 1 }, i * 2 - 0.6);
      });
      tl.to({}, { duration: 1 }); // hold the last chapter
      tl.fromTo("[data-progress]", { scaleY: 0 }, { scaleY: 1, ease: "none", duration: tl.duration() }, 0);
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={root} id="story" data-jar="story" className="relative h-[320vh]">
      <div className="sticky top-0 z-20 flex h-[100svh] items-center overflow-hidden">
        <div className="container-x grid h-full grid-cols-12 items-center">
          {/* progress rail */}
          <div className="absolute left-5 top-1/2 hidden h-48 w-px -translate-y-1/2 bg-bone/10 md:left-10 md:block">
            <div data-progress className="h-full w-full origin-top bg-ember" />
          </div>

          <div className="col-span-12 md:col-span-6 md:col-start-7">
            <div className="mb-8 flex items-end gap-6">
              <div className="relative h-[0.9em] overflow-hidden font-display text-[28vw] leading-[0.9] text-ember md:text-[12vw]">
                {chapters.map((c, i) => (
                  <span key={c.n} data-num className={`${i ? "absolute left-0 top-0" : ""} block`}>
                    {c.n}
                  </span>
                ))}
              </div>
              <span className="eyebrow mb-4 text-bone/40">/ 03</span>
            </div>

            <div className="relative min-h-[300px] md:min-h-[340px]">
              {chapters.map((c, i) => (
                <article
                  key={c.n}
                  data-chapter
                  className={`${i ? "absolute inset-x-0 top-0" : "relative"} rounded-2xl bg-char/40 p-1 backdrop-blur-[2px] md:bg-transparent md:p-0 md:backdrop-blur-0`}
                >
                  <p className="eyebrow text-ember">{c.kicker}</p>
                  <h2 className="mt-4 font-display text-5xl uppercase leading-[0.92] text-bone md:text-7xl lg:text-8xl">
                    {c.title}
                  </h2>
                  <p className="mt-6 max-w-lg text-base leading-relaxed text-bone/65 md:text-lg">{c.body}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

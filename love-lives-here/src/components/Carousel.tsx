"use client";
import { useRef, type ReactNode } from "react";

export function Carousel({ id, label, heading, children }: { id: string; label: string; heading: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const go = (dir: number) => {
    const el = ref.current;
    if (!el) return;
    const w = (el.firstElementChild as HTMLElement | null)?.getBoundingClientRect().width ?? 300;
    el.scrollBy({ left: dir * (w + 16), behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  return (
    <div>
      <div className="car-head">
        {heading}
        <div className="car-nav">
          <button type="button" className="cbtn" aria-controls={id} aria-label={`Previous ${label}`} onClick={() => go(-1)}>&larr;</button>
          <button type="button" className="cbtn" aria-controls={id} aria-label={`More ${label}`} onClick={() => go(1)}>&rarr;</button>
        </div>
      </div>
      <div className="car" id={id} ref={ref} role="region" aria-label={label} tabIndex={0}>{children}</div>
    </div>
  );
}

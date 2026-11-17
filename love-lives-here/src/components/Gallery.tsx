"use client";
import Image from "next/image";
import { useRef, useState } from "react";

type Img = { src: string; alt: string; width: number; height: number };

export function Gallery({ images, name }: { images: Img[]; name: string }) {
  const [i, setI] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const go = (n: number) => {
    setI(n);
    const el = ref.current;
    if (el) el.scrollTo({ left: n * el.clientWidth, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  return (
    <div className="gallery">
      <div className="slides" ref={ref} aria-label={`Photos of ${name}`} role="region" tabIndex={0}
        onScroll={(e) => { const el = e.currentTarget; const k = Math.round(el.scrollLeft / el.clientWidth); if (k !== i) setI(k); }}>
        {images.map((im, k) => (
          <div className="slide" key={im.src} aria-hidden={k !== i}>
            <Image src={im.src} alt={im.alt} fill priority={k === 0} sizes="(min-width: 900px) 55vw, 100vw" />
          </div>
        ))}
      </div>
      {images.length > 1 && (
        <div className="thumbs" role="group" aria-label="Choose photo">
          {images.map((im, k) => (
            <button key={im.src} type="button" aria-current={k === i} aria-label={`Show photo ${k + 1} of ${images.length}`} onClick={() => go(k)}>
              <Image src={im.src} alt="" fill sizes="64px" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

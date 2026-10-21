"use client";

import { useLayoutEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { jarState, type JarPose } from "@/lib/jarState";

gsap.registerPlugin(ScrollTrigger);

type Segment = { trigger: string; start: string; end: string; pose: Partial<JarPose> };

const TAU = Math.PI * 2;

/**
 * The jar's choreography. Each segment scrubs the shared pose while its
 * section scrolls through; the R3F rig damps toward it for buttery motion.
 */
const segments: Segment[] = [
  { trigger: "#story", start: "top bottom", end: "top top", pose: { x: -1.75, y: -0.05, rotY: TAU * 0.5, rotZ: 0.1, scale: 1.05 } },
  { trigger: "#story", start: "top top", end: "bottom bottom", pose: { x: -1.6, y: 0.05, rotY: TAU * 1.5, rotZ: -0.05, glow: 1.35 } },
  { trigger: "#shop", start: "top bottom", end: "top top", pose: { x: 0, y: 0.5, scale: 0.8, rotY: TAU * 1.75, glow: 1 } },
  { trigger: "#flavors", start: "top bottom", end: "top 15%", pose: { x: -1.85, y: -0.15, scale: 1.12, rotY: TAU * 2, rotZ: 0.12 } },
  { trigger: "#cta", start: "top bottom", end: "center center", pose: { x: 0, y: -0.15, scale: 1.18, rotY: TAU * 2.5, rotZ: 0, rotX: 0.06, glow: 1.2 } },
];

export default function ScrollDirector() {
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      segments.forEach((s) => {
        gsap.to(jarState, {
          ...s.pose,
          ease: "none",
          immediateRender: false,
          scrollTrigger: { trigger: s.trigger, start: s.start, end: s.end, scrub: true },
        });
      });
    });
    // fonts and the loader can shift layout; recalc once things settle
    const t = setTimeout(() => ScrollTrigger.refresh(), 2400);
    return () => {
      clearTimeout(t);
      ctx.revert();
    };
  }, []);
  return null;
}

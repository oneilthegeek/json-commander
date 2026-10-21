/**
 * Mutable pose shared between GSAP ScrollTrigger (writer) and the
 * R3F render loop (reader). Kept outside React state so scroll never
 * triggers re-renders — useFrame damps toward these values every frame.
 */
export type JarPose = {
  x: number;
  y: number;
  z: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  scale: number;
  /** 0–1 intensity of steam + spice particles */
  heat: number;
  /** 0–1 warmth of the key light */
  glow: number;
};

export const jarState: JarPose = {
  x: 1.6,
  y: -0.1,
  z: 0,
  rotX: 0.08,
  rotY: 0,
  rotZ: -0.06,
  scale: 1,
  heat: 1,
  glow: 1,
};

export const pointer = { x: 0, y: 0 };

/** Currently selected flavor, read by the jar to tint the sauce. */
export const flavorState = { color: "#C92A05", index: 0 };

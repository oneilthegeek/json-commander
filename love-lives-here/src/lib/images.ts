/**
 * Photo quality for next/image. AVIF/WebP at 60 is visually indistinguishable from 75 on these
 * photos at phone sizes (checked side by side, including the handwritten letter) and roughly
 * halves their weight, which matters most on slow mobile connections.
 */
export const IMG_Q = 60;

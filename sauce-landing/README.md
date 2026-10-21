# Fuego Noir — gourmet sauce landing page

A premium, scroll-driven ecommerce landing page for a fictional small-batch sauce brand.

**Stack:** Next.js 15 (App Router) · Tailwind CSS · React Three Fiber + drei · GSAP ScrollTrigger · Framer Motion · Lenis

```bash
cd sauce-landing
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
```

## What's inside

| Area | Implementation |
| --- | --- |
| 3D hero jar | Built entirely from code (`components/three/`), no model files. Thick-walled lathe glass with `MeshTransmissionMaterial` (refraction, chromatic aberration, backside thickness), a clear-coated sauce volume with a meniscus, suspended seeds, a knurled metal lid and a canvas-painted wrap label. |
| Steam | Billboarded planes with an fbm-noise GLSL shader that rises, sways and fades (`Steam.tsx`). |
| Spice particles | Three instanced fields (chilli flakes, peppercorns, seeds) orbiting the jar, plus drei `Sparkles` embers. |
| Lighting | A local Lightformer studio environment (no HDR download), a key spot that follows the pointer, and a flickering orange rim light. |
| Scroll choreography | `ScrollDirector.tsx` scrubs a shared pose object (`lib/jarState.ts`) section by section; the R3F rig damps toward it every frame, so scrolling never re-renders React. |
| Storytelling | `Story` uses a sticky stage and a scrubbed GSAP timeline for three chapters; `Shop` turns vertical scroll into a horizontal product rail. |
| Micro-interactions | Custom cursor with labels, magnetic buttons, 3D-tilt product cards with glare, morphing add-to-cart and cart badge, flavour tabs with a shared `layoutId` pill that also re-tints the 3D sauce, word-mask text reveals, and an intro loader. |
| Texture | SVG fractal-noise paper on solid panels and animated film grain over everything. |

## Layering

The WebGL canvas is `fixed` at `z-10`. Oversized background type sits at `z-0` (behind the jar) and content sits at `z-20`. Sections with solid backgrounds (`Shop`, `Ingredients`, marquees, footer) slide *over* the jar, and transparent sections reveal it.

## Performance and accessibility

- Touch devices and machines with 4 or fewer cores get a lighter tier: standard physical glass instead of transmission, fewer particles and a lower DPR.
- `prefers-reduced-motion` turns off Lenis and CSS animations.
- The custom cursor only runs on fine pointers.

## Customising

- Products, flavours and ingredients live in `lib/data.ts`.
- The colour palette is in `tailwind.config.ts` (`ember`, `char`, `bone`).
- To change the jar's path through the page, edit the `segments` array in `components/ScrollDirector.tsx`.
- The label artwork is drawn in `components/three/labelTexture.ts`.

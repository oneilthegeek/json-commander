import type { Ingredient } from "@/lib/data";

const paths: Record<Ingredient["glyph"], React.ReactNode> = {
  chili: (
    <>
      <path d="M20 14c6-2 10 2 9 8-1 9-10 18-20 20 4-6 6-12 6-18 0-5 2-9 5-10z" />
      <path d="M22 14c0-4 2-7 6-8" />
    </>
  ),
  garlic: (
    <>
      <path d="M24 8c2 4 10 8 10 18a10 10 0 0 1-20 0c0-10 8-14 10-18z" />
      <path d="M24 12v26M18 20c2 4 2 10 0 16M30 20c-2 4-2 10 0 16" />
    </>
  ),
  salt: (
    <>
      <path d="M12 28l8-14 8 6 8-8 2 16-12 10z" />
      <path d="M20 14l4 22M28 20l-4 16" />
    </>
  ),
  honey: (
    <>
      <path d="M24 6l12 7v14l-12 7-12-7V13z" />
      <path d="M24 34c0 4-2 6-2 8a2 2 0 0 0 4 0c0-2-2-4-2-8z" />
    </>
  ),
  citrus: (
    <>
      <circle cx="24" cy="24" r="14" />
      <path d="M24 10v28M10 24h28M14 14l20 20M34 14L14 34" />
    </>
  ),
  pepper: (
    <>
      <circle cx="17" cy="20" r="6" />
      <circle cx="30" cy="17" r="5" />
      <circle cx="26" cy="31" r="7" />
    </>
  ),
};

export default function IngredientGlyph({ glyph, className }: { glyph: Ingredient["glyph"]; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
      {paths[glyph]}
    </svg>
  );
}

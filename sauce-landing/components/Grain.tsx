/** Animated film grain over everything for a tactile, printed feel. */
export default function Grain() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[90] overflow-hidden opacity-[0.09] mix-blend-overlay">
      <div className="grain absolute -inset-[50%] h-[200%] w-[200%] animate-grain" />
    </div>
  );
}

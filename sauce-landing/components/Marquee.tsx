const words = ["Small batch", "Oak smoked", "Fire roasted", "No shortcuts", "Hand bottled", "Seriously hot"];

export default function Marquee({ tilt = -2, inverted = false }: { tilt?: number; inverted?: boolean }) {
  const row = [...words, ...words];
  return (
    <div
      className={`relative z-20 overflow-hidden py-5 md:py-7 ${inverted ? "bg-char text-ember" : "paper bg-ember text-char"}`}
      style={{ transform: `rotate(${tilt}deg) scale(1.05)` }}
    >
      <div className="flex w-max animate-marquee whitespace-nowrap">
        {[0, 1].map((k) => (
          <div key={k} className="flex shrink-0 items-center" aria-hidden={k === 1}>
            {row.map((w, i) => (
              <span key={i} className="flex items-center font-display text-5xl uppercase md:text-7xl">
                <span className="px-6">{w}</span>
                <svg width="38" height="38" viewBox="0 0 24 24" className="shrink-0">
                  <path fill="currentColor" d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-6 1-10z" />
                </svg>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Lightweight vector jar for product cards (avoids extra WebGL contexts). */
export default function JarIllustration({ color, accent, name }: { color: string; accent: string; name: string }) {
  const id = name.replace(/\s/g, "");
  return (
    <svg viewBox="0 0 200 280" className="h-full w-full drop-shadow-[0_30px_40px_rgba(0,0,0,0.45)]">
      <defs>
        <linearGradient id={`sauce-${id}`} x1="0" x2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.75" />
          <stop offset="0.35" stopColor={accent} />
          <stop offset="0.6" stopColor={color} />
          <stop offset="1" stopColor="#1a0500" />
        </linearGradient>
        <linearGradient id={`glass-${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="0.15" stopColor="#fff" stopOpacity="0.04" />
          <stop offset="0.8" stopColor="#fff" stopOpacity="0.02" />
          <stop offset="0.92" stopColor="#fff" stopOpacity="0.25" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id={`lid-${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="#333" />
          <stop offset="0.3" stopColor="#0a0a0a" />
          <stop offset="0.55" stopColor="#555" />
          <stop offset="1" stopColor="#050505" />
        </linearGradient>
      </defs>
      {/* sauce */}
      <path d="M38 110 Q38 98 50 96 H150 Q162 98 162 110 V250 Q162 264 148 264 H52 Q38 264 38 250 Z" fill={`url(#sauce-${id})`} />
      {/* glass body */}
      <path
        d="M30 90 Q30 70 52 64 V48 H148 V64 Q170 70 170 90 V252 Q170 272 150 272 H50 Q30 272 30 252 Z"
        fill={`url(#glass-${id})`}
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="1.5"
      />
      {/* label */}
      <rect x="30" y="140" width="140" height="84" fill="#0d0b0a" />
      <rect x="30" y="146" width="140" height="2" fill={accent} />
      <rect x="30" y="216" width="140" height="2" fill={accent} />
      <text x="100" y="186" textAnchor="middle" fill={accent} fontFamily="var(--font-display)" fontSize="26" letterSpacing="1">
        FUEGO
      </text>
      <text x="100" y="206" textAnchor="middle" fill="#F4EBDD" fontFamily="var(--font-serif)" fontStyle="italic" fontSize="16">
        {name}
      </text>
      {/* lid */}
      <rect x="44" y="18" width="112" height="36" rx="6" fill={`url(#lid-${id})`} />
      {Array.from({ length: 27 }).map((_, i) => (
        <rect key={i} x={48 + i * 4} y="22" width="1.2" height="28" fill="rgba(255,255,255,0.08)" />
      ))}
      {/* highlight */}
      <path d="M44 100 Q42 180 46 250" stroke="rgba(255,255,255,0.55)" strokeWidth="5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

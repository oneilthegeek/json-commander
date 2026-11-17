/** The LLH Tag illustration from the original site (there is no photo of the tag yet). */
export function TagArt({ label = "A round LLH Tag sticker" }: { label?: string }) {
  return (
    <svg viewBox="0 0 300 340" role="img" aria-label={label} style={{ width: "100%", height: "100%", display: "block" }}>
      <rect width="300" height="340" fill="#F2E4E1" />
      <circle cx="150" cy="165" r="92" fill="#4A1220" />
      <circle cx="150" cy="165" r="80" fill="none" stroke="#E2BE78" strokeWidth="1.5" />
      <g fill="none" stroke="#E2BE78" strokeWidth="7" strokeLinecap="round">
        <path d="M141 172 l-12 12 a16 16 0 0 1 -22 -22 l14 -14 a16 16 0 0 1 22 0" />
        <path d="M159 158 l12 -12 a16 16 0 0 1 22 22 l-14 14 a16 16 0 0 1 -22 0" />
        <path d="M137 177 l26 -26" />
      </g>
      <text x="150" y="232" textAnchor="middle" fontFamily="Bodoni Moda, Georgia, serif" fontStyle="italic" fontSize="16" fill="#FFF4EE">LLH</text>
    </svg>
  );
}

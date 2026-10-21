export default function Footer() {
  const cols = [
    { h: "Shop", l: ["All sauces", "Gift boxes", "Subscriptions", "Merch"] },
    { h: "House", l: ["Our story", "Growers", "Recipes", "Stockists"] },
    { h: "Help", l: ["Shipping", "Returns", "Contact", "FAQ"] },
  ];
  return (
    <footer className="relative z-20 overflow-hidden bg-char-800 pt-20">
      <div className="container-x grid gap-12 md:grid-cols-12">
        <div className="md:col-span-4">
          <p className="font-serif text-3xl italic text-bone">Fire within. Flavour beyond.</p>
          <p className="mt-4 max-w-xs text-sm text-bone/50">Smoked, fermented and bottled by hand. Shipping worldwide from our kitchen.</p>
        </div>
        {cols.map((c) => (
          <div key={c.h} className="md:col-span-2">
            <p className="eyebrow text-ember">{c.h}</p>
            <ul className="mt-5 space-y-3">
              {c.l.map((x) => (
                <li key={x}>
                  <a href="#" className="text-sm text-bone/70 transition-colors hover:text-ember">
                    {x}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="md:col-span-2">
          <p className="eyebrow text-ember">Social</p>
          <ul className="mt-5 space-y-3 text-sm text-bone/70">
            <li><a href="#" className="hover:text-ember">Instagram</a></li>
            <li><a href="#" className="hover:text-ember">TikTok</a></li>
            <li><a href="#" className="hover:text-ember">YouTube</a></li>
          </ul>
        </div>
      </div>
      <div className="container-x mt-20 flex items-center justify-between border-t border-bone/10 py-6 text-xs text-bone/40">
        <span>© {new Date().getFullYear()} Fuego Noir Sauce Co.</span>
        <span>Handle with respect.</span>
      </div>
      <div aria-hidden className="select-none whitespace-nowrap text-center font-display text-[25vw] uppercase leading-[0.75] text-ember">
        Fuego Noir
      </div>
    </footer>
  );
}

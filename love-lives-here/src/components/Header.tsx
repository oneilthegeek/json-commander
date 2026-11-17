"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useCart } from "./cart";

const NAV = [
  { href: "/shop", label: "Shop" },
  { href: "/shop?c=flowers", label: "Flowers" },
  { href: "/letter", label: "Start a letter" },
  { href: "/gold-card", label: "Gold Card" },
  { href: "/#how", label: "How it works" },
  { href: "/#journal", label: "Dear Lovers" },
  { href: "/track", label: "Track order" },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const { count, ready } = useCart();
  const path = usePathname();
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="site-head">
      <div className={`box nav${open ? " open" : ""}`}>
        <Link className="logo" href="/">Love Lives Here</Link>
        <nav className="links" id="mainnav" aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={path === n.href ? "page" : undefined} onClick={() => setOpen(false)}>{n.label}</Link>
          ))}
        </nav>
        <div className="icons">
          <Link className="icon-btn" href="/cart" aria-label={`Your bag, ${ready ? count : 0} item${count === 1 ? "" : "s"}`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M5 8h14l-1 12H6L5 8z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>
            {ready && count > 0 && <span className="count" aria-hidden="true">{count}</span>}
          </Link>
          <button ref={btn} className="burger" type="button" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="mainnav" onClick={() => setOpen((o) => !o)}>
            <span /><span /><span />
          </button>
        </div>
      </div>
    </header>
  );
}

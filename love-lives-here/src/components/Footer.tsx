import Link from "next/link";
import { getSetting } from "@/lib/settings";
import { waLink } from "@/lib/wa";

export async function Footer() {
  const b = await getSetting("business");
  return (
    <footer className="site-foot">
      <div className="box foot">
        <div>
          <span style={{ fontFamily: "var(--display)", fontSize: 26, color: "#FFF4EE" }}>Love Lives Here</span>
          <span style={{ lineHeight: 1.6 }}>Handwritten love letters and thoughtful gifts, made in Lagos. Sealed in wax, delivered across Nigeria.</span>
        </div>
        <div>
          <h2>Shop</h2>
          <Link href="/shop/handwritten-letter">The Letter</Link>
          <Link href="/shop/secret-candle">The Secret Candle</Link>
          <Link href="/gold-card">The Gold Card</Link>
          <Link href="/shop/llh-tag">The LLH Tag</Link>
          <Link href="/shop?c=flowers">Flowers</Link>
        </div>
        <div>
          <h2>Help</h2>
          <Link href="/track">Track your order</Link>
          <Link href="/delivery">Delivery &amp; fees</Link>
          <Link href="/faq">Questions</Link>
          <Link href="/contact">Contact us</Link>
          <a href={waLink(b.whatsapp, "Hi LLH, I have a question.")} rel="noopener noreferrer" target="_blank">WhatsApp {b.phoneDisplay}</a>
          <a href={`mailto:${b.email}`}>{b.email}</a>
        </div>
        <div>
          <h2>Policies</h2>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/refunds">Refunds &amp; returns</Link>
          <Link href="/delivery">Delivery policy</Link>
        </div>
        <div>
          <h2>Follow</h2>
          <a rel="noopener noreferrer" target="_blank" href={b.instagram}>Instagram</a>
          <a rel="noopener noreferrer" target="_blank" href={b.tiktok}>TikTok</a>
          <a rel="noopener noreferrer" target="_blank" href={b.substackProfile}>Dear Lovers on Substack</a>
        </div>
      </div>
      <div className="box legal"><span>© {new Date().getFullYear()} Love Lives Here</span><span>loveliveshere.ng · @loveliveshere.ng</span></div>
    </footer>
  );
}

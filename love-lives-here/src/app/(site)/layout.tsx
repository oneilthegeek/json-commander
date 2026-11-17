import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CartProvider } from "@/components/cart";
import { WhatsAppFloat } from "@/components/WhatsApp";
import { PageView } from "@/components/PageView";
import { getSetting } from "@/lib/settings";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const b = await getSetting("business");
  return (
    <CartProvider>
      <a className="skip" href="#main">Skip to content</a>
      <div className="bar">Handcrafted in Lagos · Delivered across Nigeria · Read it before we seal it</div>
      <Header />
      <main id="main" tabIndex={-1}>{children}</main>
      <Footer />
      <WhatsAppFloat number={b.whatsapp} />
      <PageView />
    </CartProvider>
  );
}

import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Karla, Caveat } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { appUrl } from "@/lib/config";

const bodoni = Bodoni_Moda({ subsets: ["latin"], weight: ["400", "500"], style: ["normal", "italic"], variable: "--font-bodoni", display: "swap", preload: false, adjustFontFallback: true });
const karla = Karla({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-karla", display: "swap" });
const caveat = Caveat({ subsets: ["latin"], weight: ["500"], variable: "--font-caveat", display: "swap", preload: false });

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: { default: "Love Lives Here — Handwritten Love Letters in Lagos, Sealed in Wax", template: "%s · Love Lives Here" },
  description: "Handwritten love letters and thoughtful gifts in Lagos, Nigeria. Sealed in wax, delivered across Lagos and nationwide. Read your letter before we seal it.",
  applicationName: "Love Lives Here",
  openGraph: {
    type: "website", siteName: "Love Lives Here", locale: "en_NG",
    images: [{ url: "/images/og-love-lives-here.jpg", width: 1200, height: 630, alt: "A hand holding two kraft envelopes sealed with burgundy LLH wax seals" }],
  },
  twitter: { card: "summary_large_image", images: ["/images/og-love-lives-here.jpg"] },
  other: { "geo.region": "NG-LA", "geo.placename": "Lagos, Nigeria" },
  icons: { icon: "/icon.svg" },
  // Google Search Console "HTML tag" verification (DNS TXT verification needs no code). Set the
  // content value from Search Console in GOOGLE_SITE_VERIFICATION; nothing is emitted when unset.
  ...(process.env.SITE_PREVIEW_NOTICE ? { robots: { index: false, follow: false } } : {}),
  ...(process.env.GOOGLE_SITE_VERIFICATION ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } } : {}),
};

export const viewport: Viewport = { themeColor: "#4A1220", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading the request makes every page render per request, so Next can attach
  // this request's CSP nonce to its scripts (static HTML can't carry a nonce).
  await headers();
  return (
    <html lang="en-NG" className={`${bodoni.variable} ${karla.variable} ${caveat.variable}`}>
      <body>
        {/* Staging/preview servers only: set SITE_PREVIEW_NOTICE to show a strip on every page and keep search engines out. */}
        {process.env.SITE_PREVIEW_NOTICE && <div className="preview-note" role="note">{process.env.SITE_PREVIEW_NOTICE}</div>}
        {children}
      </body>
    </html>
  );
}

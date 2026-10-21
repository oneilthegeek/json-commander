import type { Metadata, Viewport } from "next";
import { Anton, Inter, Instrument_Serif } from "next/font/google";
import "./globals.css";

const display = Anton({ subsets: ["latin"], weight: "400", variable: "--font-display" });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-serif" });

export const metadata: Metadata = {
  title: "Fuego Noir — Small-Batch Gourmet Sauces",
  description:
    "Fire-roasted, oak-smoked, small-batch gourmet sauces. Crafted in the dark, made to ignite.",
};

export const viewport: Viewport = {
  themeColor: "#0B0908",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${serif.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}

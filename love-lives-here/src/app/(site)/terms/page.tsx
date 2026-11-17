import type { Metadata } from "next";
import Link from "next/link";
import { Policy } from "@/components/Policy";

export const metadata: Metadata = { title: "Terms and conditions", description: "The terms that apply when you order from Love Lives Here.", alternates: { canonical: "/terms" } };

export default function Terms() {
  return (
    <Policy title="Terms and conditions" lab="The small print" updated="17 November 2026">
      <p>These terms apply when you order from Love Lives Here (“LLH”) through loveliveshere.ng. By placing an order you agree to them.</p>
      <h2>Your order</h2>
      <ul>
        <li>Prices are in Naira and shown before you pay. The delivery fee for listed Lagos areas is fixed; for other areas and other states we confirm the fee before you pay.</li>
        <li>Your order is confirmed only when payment has been verified. We&apos;ll email a receipt and keep your order page updated.</li>
        <li>If something becomes unavailable after you pay, we&apos;ll offer an alternative or a refund for that item.</li>
      </ul>
      <h2>Letters and personal content</h2>
      <ul>
        <li>We write and handwrite letters from what you tell us. We don&apos;t invent memories or facts about you or the recipient.</li>
        <li>For letters that need approval, we send you the words first. We don&apos;t seal or produce the letter until you approve it. Once approved, the words can&apos;t be changed.</li>
        <li>You&apos;re responsible for the content you send us. We may decline content that is unlawful, abusive, threatening, or that could harm someone, and refund you if we do.</li>
        <li>Handwriting and handmade items vary slightly — that&apos;s part of what makes them yours.</li>
      </ul>
      <h2>Delivery</h2>
      <p>We deliver on the date you choose, if it&apos;s available at checkout. Times are a preference, not a guarantee. See our <Link href="/delivery">delivery policy</Link> for what happens if the recipient isn&apos;t available.</p>
      <h2>Gold Card and LLH Tag</h2>
      <p>The card or tag opens a web page we host. It needs an internet connection and a phone that can read NFC tags or scan a QR code. We keep the page available for at least 12 months unless you choose an expiry date or ask us to remove it.</p>
      <h2>Cancellations and refunds</h2>
      <p>See our <Link href="/refunds">refunds and returns policy</Link>.</p>
      <h2>Liability</h2>
      <p>Nothing in these terms limits your rights under Nigerian consumer protection law, including the Federal Competition and Consumer Protection Act 2018. We&apos;re not responsible for delays caused by events outside our reasonable control, such as severe weather, road closures or strikes, but we&apos;ll keep you informed and agree a new date or refund.</p>
      <h2>Governing law</h2>
      <p>These terms are governed by the laws of the Federal Republic of Nigeria. If we can&apos;t resolve a complaint together, it may be brought before the courts of Lagos State, without affecting your right to contact the Federal Competition and Consumer Protection Commission.</p>
      <h2>Contact</h2>
      <p><Link href="/contact">Contact us</Link> with any question about these terms.</p>
    </Policy>
  );
}

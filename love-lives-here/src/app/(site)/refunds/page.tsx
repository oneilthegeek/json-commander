import type { Metadata } from "next";
import Link from "next/link";
import { Policy } from "@/components/Policy";

export const metadata: Metadata = { title: "Refunds and returns", description: "Cancellations, refunds, damaged orders and delays at Love Lives Here.", alternates: { canonical: "/refunds" } };

export default function Refunds() {
  return (
    <Policy title="Refunds and returns" lab="If something goes wrong" updated="17 November 2026">
      <p>Every order is made for one person, so we can&apos;t resell it. That&apos;s why our policy depends on how far along your order is.</p>
      <h2>Cancelling</h2>
      <ul>
        <li><strong>Before we start production</strong> (before your letter is approved, or before we begin making other items): you can cancel for a full refund.</li>
        <li><strong>After production starts:</strong> the order can&apos;t be cancelled or changed, because it has been made for you.</li>
      </ul>
      <h2>Damaged or wrong items</h2>
      <p>If anything arrives damaged, or isn&apos;t what you ordered, tell us within 48 hours with a photo. We&apos;ll replace it or refund it — your choice.</p>
      <h2>Late or failed delivery</h2>
      <ul>
        <li>If we miss your delivery date through our fault, we&apos;ll refund the delivery fee, and you can choose a full refund if the date mattered (for example a birthday that has passed).</li>
        <li>If the rider can&apos;t deliver because the address is wrong or no one is available, we&apos;ll contact you to arrange another attempt. A second delivery may cost the delivery fee again.</li>
      </ul>
      <h2>Flowers</h2>
      <p>Flowers are perishable and can&apos;t be returned. If they arrive in poor condition, send us a photo on the day and we&apos;ll make it right.</p>
      <h2>Gold Card content</h2>
      <p>If the card doesn&apos;t open its page, we&apos;ll fix the link, send a QR code, or replace the card.</p>
      <h2>How refunds are paid</h2>
      <p>Card payments are refunded through Paystack to the original card or account. Refunds usually take 5–10 working days to appear, depending on your bank. Payments made by bank transfer are refunded to the account they came from.</p>
      <h2>Ask us</h2>
      <p><Link href="/contact">Contact us</Link> with your order number and we&apos;ll reply within one working day.</p>
    </Policy>
  );
}

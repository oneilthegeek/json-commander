import type { Metadata } from "next";
import { Policy } from "@/components/Policy";
import { getSetting } from "@/lib/settings";

export const metadata: Metadata = { title: "Privacy notice", description: "How Love Lives Here collects, uses and protects your personal data and the messages you trust us with.", alternates: { canonical: "/privacy" } };

export default async function Privacy() {
  const b = await getSetting("business");
  return (
    <Policy title="Privacy notice" lab="Your data" updated="17 November 2026">
      <p>Love Lives Here (“LLH”, “we”) makes handwritten letters and gifts in Lagos, Nigeria. You trust us with personal and sometimes intimate words. This notice explains what we collect, why, how long we keep it and your rights under the Nigeria Data Protection Act 2023 (NDPA).</p>
      <h2>Who is responsible</h2>
      <p>Love Lives Here is the data controller. Contact us about privacy at <a href={`mailto:${b.email}`}>{b.email}</a> or on WhatsApp ({b.phoneDisplay}).</p>
      <h2>What we collect</h2>
      <ul>
        <li><strong>Your details:</strong> name, WhatsApp/phone number, email address.</li>
        <li><strong>The recipient&apos;s details:</strong> name, delivery address, and (optionally) phone number for the rider.</li>
        <li><strong>Your letter brief:</strong> your message, or the answers you give us (relationship, occasion, feelings, memories, things to avoid), and your feedback on drafts.</li>
        <li><strong>Gold Card content:</strong> notes, photos, voice recordings and links you add.</li>
        <li><strong>Order and payment records:</strong> items, prices, delivery date, payment reference and status. Card payments are handled by Paystack; we never see or store your card number.</li>
        <li><strong>Messages to us</strong> through our contact form, email or WhatsApp.</li>
        <li><strong>Anonymous usage data:</strong> pages viewed and shop actions (for example “added to bag”), with a random session ID that is not linked to you. We don&apos;t use advertising cookies.</li>
      </ul>
      <h2>Why we use it, and our lawful basis</h2>
      <ul>
        <li><strong>To make and deliver your order</strong> and keep you updated — performing our contract with you.</li>
        <li><strong>To deliver to the recipient</strong> — our legitimate interest in completing the gift you asked us to send. We use their details only for delivery and the Gold Card experience.</li>
        <li><strong>To keep financial records</strong> — legal obligation (tax and accounting).</li>
        <li><strong>To prevent fraud and secure our systems</strong> — legitimate interests.</li>
        <li><strong>To send Dear Lovers emails</strong> — your consent, which you can withdraw at any time.</li>
      </ul>
      <h2>Who sees it</h2>
      <p>Only the LLH team members who need it: writers see your letter brief but not your address; packing and delivery staff see the address but not your letter brief. We share data only with services that help us run the shop: Paystack (payments), our hosting and database provider, our email provider, and our delivery rider (recipient name, address, optional phone, on the day). We never sell your data.</p>
      <h2>Transfers outside Nigeria</h2>
      <p>Some providers (for example hosting or email) may store data outside Nigeria. Where they do, we rely on safeguards permitted by the NDPA, such as contractual protections, and choose providers with strong security.</p>
      <h2>How long we keep it</h2>
      <ul>
        <li>Letter briefs, drafts, recipient addresses and phone numbers: deleted or anonymised about <strong>120 days after delivery</strong>, unless you ask us to keep them for a future order.</li>
        <li>Gold Card content: kept while the card is active, then deleted when it expires or when you ask.</li>
        <li>Order and payment records (without letter content): kept for six years for tax and accounting.</li>
        <li>Contact-form messages: up to one year.</li>
      </ul>
      <h2>Your rights</h2>
      <p>You can ask to access, correct or delete your data, to restrict or object to how we use it, to receive it in a portable format, and to withdraw consent. Message us at <a href={`mailto:${b.email}`}>{b.email}</a>; we&apos;ll respond within 30 days. If you&apos;re unhappy with how we handle your data, you can complain to the Nigeria Data Protection Commission (NDPC).</p>
      <h2>If you send a gift</h2>
      <p>Please only share the recipient&apos;s details you need to share for the delivery, and only things you&apos;re comfortable with us reading. If the recipient contacts us, we&apos;ll respect their rights too.</p>
      <h2>Security</h2>
      <p>Our site uses HTTPS. Staff accounts use strong passwords and two-factor sign-in. Gold Card pages use long, random links that can&apos;t be guessed, and can be protected with a code or set to expire. Access to orders is logged.</p>
      <h2>Children</h2>
      <p>Our shop is for adults (18+). We don&apos;t knowingly collect data from children except as a gift recipient&apos;s name and address supplied by an adult.</p>
      <h2>Changes</h2>
      <p>We&apos;ll update this notice when our practices change and show the new date and version above. The version you agreed to is saved with your order.</p>
    </Policy>
  );
}

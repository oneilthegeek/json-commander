"use client";
import { track } from "./track";
import { waLink } from "@/lib/wa";

export function WhatsAppLink({ number, text, children, className, label }: { number: string; text: string; children: React.ReactNode; className?: string; label?: string }) {
  return (
    <a className={className} href={waLink(number, text)} rel="noopener noreferrer" target="_blank" aria-label={label} onClick={() => track("whatsapp_click")}>
      {children}
    </a>
  );
}

export function WhatsAppFloat({ number }: { number: string }) {
  return (
    <WhatsAppLink className="wa-float" number={number} text="Hi LLH, I'd like some help with an order." label="Chat with us on WhatsApp (opens WhatsApp)">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z" /><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 1c-1-.5-2-1.5-2.5-2.5l1-1-1-2z" /></svg>
    </WhatsAppLink>
  );
}

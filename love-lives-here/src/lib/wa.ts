/** WhatsApp click-to-chat link (https://faq.whatsapp.com/5913398998672934). */
export function waLink(e164OrDigits: string, text?: string): string {
  const digits = e164OrDigits.replace(/\D/g, "");
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

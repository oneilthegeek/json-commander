/** Request validation, shared by the API (authoritative) and forms (convenience). */
import { z } from "zod";
import { validatePhone } from "./phone";

const clean = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters.`);
const optionalText = (max: number) => clean(max).optional().transform((v) => (v ? v : undefined));

export const RELATIONSHIPS = ["Partner", "Wife or husband", "Crush", "Best friend", "Mum or dad", "Sister or brother", "Friend", "Colleague", "Someone else"] as const;
export const OCCASIONS = ["Just because", "Birthday", "Anniversary", "Apology", "Long distance", "Valentine's", "Thank you", "Mother's Day", "Father's Day", "Something else"] as const;
export const TONES = ["Romantic", "Sweet", "Deep", "Funny", "I'm sorry", "Grateful"] as const;

export const letterBriefSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("own_words"),
    message: clean(6000).min(20, "Write at least a few sentences — rough is fine."),
    signOff: optionalText(120),
    tone: optionalText(40),
  }),
  z.object({
    mode: z.literal("help_me"),
    relationship: clean(60).min(1, "Tell us who they are to you."),
    occasion: clean(60).min(1, "Choose an occasion."),
    feelings: clean(2000).min(10, "Tell us, in a sentence or two, what you want them to feel."),
    memories: optionalText(4000),
    nicknames: optionalText(300),
    tone: optionalText(40),
    avoid: optionalText(1000),
    signOff: optionalText(120),
  }),
]);
export type LetterBrief = z.infer<typeof letterBriefSchema>;

const phone = (opts: { nigeriaOnly?: boolean } = {}) =>
  z.string().trim().max(30).transform((v, ctx) => {
    const r = validatePhone(v, opts);
    if (!r.ok) {
      ctx.addIssue({ code: "custom", message: r.error });
      return z.NEVER;
    }
    return r.e164;
  });

export const checkoutSchema = z.object({
  checkoutKey: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/, "Invalid checkout key"),
  lines: z.array(z.object({ variantId: z.uuid(), quantity: z.number().int().min(1).max(20) })).min(1, "Your bag is empty.").max(30),
  buyer: z.object({
    name: clean(80).min(2, "Enter your name."),
    phone: phone(),
    // Required: Paystack needs it to start a payment, and it's where receipts go.
    email: z.email("Enter a valid email address like ada@gmail.com.").max(160).transform((v) => v.toLowerCase()),
  }),
  recipient: z.object({
    name: clean(80).min(1, "Enter their name."),
    phone: z.union([z.literal(""), phone({ nigeriaOnly: true })]).optional().transform((v) => (v ? v : undefined)),
  }),
  delivery: z.object({
    zoneId: z.number().int().positive("Choose a delivery area."),
    address: optionalText(400),
    instructions: optionalText(500),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a delivery date."),
    window: z.enum(["any", "morning", "afternoon", "evening"]).default("any"),
  }),
  letter: letterBriefSchema.optional(),
  giftNote: optionalText(500),
  photoBeforeDispatch: z.boolean().default(false),
  consent: z.literal(true, { error: "Please confirm you've read how we handle your details." }),
  marketingOptIn: z.boolean().default(false),
  source: z.object({
    source: optionalText(80), medium: optionalText(80), campaign: optionalText(120), referrer: optionalText(300),
  }).optional(),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const supportSchema = z.object({
  name: clean(80).min(2, "Enter your name."),
  contact: clean(160).min(5, "Enter a phone number or email so we can reply."),
  orderNumber: z.union([z.literal(""), z.string().trim().toUpperCase().regex(/^LLH-[A-Z0-9]{7}$/, "Order numbers look like LLH-AB3CD7E.")]).optional(),
  message: clean(3000).min(10, "Tell us a little more."),
  website: z.string().max(0).optional(), // honeypot
});

export const emailSchema = z.email("Enter an email address like ada@gmail.com.").max(160);

/** Flattens zod issues into {path: message} for forms. */
export function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) {
    const k = i.path.join(".") || "_";
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

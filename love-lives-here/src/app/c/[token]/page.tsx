import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { availability, getExperienceByToken, safeExternalUrl } from "@/lib/nfc";
import { isUnlocked } from "@/lib/nfc-access";
import { getDb, schema } from "@/lib/db";
import { GoldCardView } from "@/components/GoldCardView";
import { UnlockForm } from "./UnlockForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "A letter is waiting for you", robots: { index: false, follow: false }, referrer: "no-referrer" };

const MESSAGES = {
  not_found: ["This card isn't set up", "If you just received it, it may not be switched on yet. Please try again later."],
  inactive: ["Almost ready", "This card isn't switched on yet. Please try again a little later."],
  not_yet: ["Not just yet", "This message has been saved for a special moment. Try again then."],
  expired: ["This message has ended", "The sender chose for this card's messages to be available for a limited time."],
} as const;

export default async function CardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const e = await getExperienceByToken(token);
  const unlocked = e ? await isUnlocked(e.id) : false;
  const av = availability(e, new Date(), { unlocked });

  if (!av.ok) {
    if (av.reason === "locked") return <div className="gc"><main className="gc-card" id="main"><div className="seal" aria-hidden="true">LLH</div><h1>A letter is waiting for you</h1><UnlockForm token={token} /></main></div>;
    const [h, p] = MESSAGES[av.reason];
    return <div className="gc"><main className="gc-card center" id="main"><div className="seal" aria-hidden="true">LLH</div><h1>{h}</h1><p style={{ color: "var(--on-dark-muted)" }}>{p}</p></main></div>;
  }

  await getDb().update(schema.nfcExperiences).set({ viewCount: sql`${schema.nfcExperiences.viewCount} + 1`, lastViewedAt: new Date() }).where(eq(schema.nfcExperiences.id, e!.id));

  if (e!.kind === "llh_tag") {
    const url = safeExternalUrl(e!.redirectUrl);
    if (url) redirect(url);
  }
  return <GoldCardView e={e!} items={e!.items} mediaUrl={(id) => `/c/${token}/media/${id}`} />;
}

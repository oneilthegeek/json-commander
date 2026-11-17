import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buyerCard } from "../access";
import { GoldCardView } from "@/components/GoldCardView";
import type { DayPart } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Preview", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function Preview({ params, searchParams }: { params: Promise<{ number: string; id: string }>; searchParams: Promise<{ t?: string; part?: string }> }) {
  const { number, id } = await params;
  const { t = "", part } = await searchParams;
  const ctx = await buyerCard(number, id, t);
  if (!ctx) notFound();
  const q = `?t=${encodeURIComponent(t)}`;
  const p = (["morning", "afternoon", "evening", "night"] as const).includes(part as DayPart) ? (part as DayPart) : undefined;
  return (
    <>
      <nav className="box row" aria-label="Preview time of day" style={{ paddingBlock: 12 }}>
        <a href={`/orders/${number}/card/${id}${q}`}>← Back to editing</a>
        {(["morning", "afternoon", "evening", "night"] as const).map((x) => <a key={x} className="pill" aria-current={x === p ? "page" : undefined} href={`/orders/${number}/card/${id}/preview${q}&part=${x}`}>{x}</a>)}
      </nav>
      <GoldCardView e={ctx.e} items={ctx.e.items} part={p} preview mediaUrl={(a) => `/orders/${number}/card/${id}/media/${a}${q}`} />
    </>
  );
}

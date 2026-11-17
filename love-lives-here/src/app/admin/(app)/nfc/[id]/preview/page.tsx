import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireStaff } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { GoldCardView } from "@/components/GoldCardView";
import type { DayPart } from "@/lib/dates";

export const metadata = { title: "Preview card" };

export default async function Preview({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ part?: string }> }) {
  await requireStaff("nfc.edit");
  const { id } = await params;
  const { part } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const e = await getDb().query.nfcExperiences.findFirst({ where: eq(schema.nfcExperiences.id, id), with: { items: { orderBy: (t, { asc }) => [asc(t.sort), asc(t.createdAt)] } } });
  if (!e) notFound();
  const p = (["morning", "afternoon", "evening", "night"] as const).includes(part as DayPart) ? (part as DayPart) : undefined;
  return (
    <>
      <nav className="row" aria-label="Preview time of day" style={{ paddingBlock: 12 }}>
        <a href={`/admin/nfc/${id}`}>← Back</a>
        {(["morning", "afternoon", "evening", "night"] as const).map((x) => <a key={x} className="pill" aria-current={x === p ? "page" : undefined} href={`?part=${x}`}>{x}</a>)}
      </nav>
      <GoldCardView e={e} items={e.items} part={p} preview mediaUrl={(a) => `/admin/nfc/${id}/media/${a}`} />
    </>
  );
}

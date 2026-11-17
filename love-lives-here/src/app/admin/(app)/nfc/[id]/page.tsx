import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireStaff } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getDb, schema } from "@/lib/db";
import { publicUrl, qrSvg } from "@/lib/nfc";
import { formatDateTime } from "@/lib/dates";
import { CardEditor } from "@/components/CardEditor";
import { ActionForm } from "@/components/ActionForm";
import { cardOp } from "../../actions";

export const metadata = { title: "Gold Card" };

const toLocal = (d: Date | null) => (d ? new Date(d.getTime() + 3600_000).toISOString().slice(0, 16) : "");

export default async function NfcAdmin({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireStaff();
  const edit = can(s.role, "nfc.edit");
  if (!edit && !can(s.role, "nfc.write")) notFound();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const e = await getDb().query.nfcExperiences.findFirst({ where: eq(schema.nfcExperiences.id, id), with: { items: { orderBy: (t, { asc }) => [asc(t.sort), asc(t.createdAt)] }, order: true } });
  if (!e) notFound();
  const url = publicUrl(e.publicToken);
  const qr = await qrSvg(e.publicToken);
  const bind = (op: Parameters<typeof cardOp>[1]) => cardOp.bind(null, e.id, op);
  return (
    <div className="stack" style={{ gap: 20 }}>
      <p>{e.order && <Link href={`/admin/orders/${e.order.id}`}>← Order {e.order.number}</Link>}</p>
      <div className="row between"><h1 style={{ fontSize: 34 }}>{e.kind === "gold_card" ? "Gold Card" : "LLH Tag"} <span className="badge">{e.status}</span></h1>
        <Link className="btn btn-ghost btn-sm" href={`/admin/nfc/${e.id}/preview`}>Preview</Link></div>
      <div className="cols">
        {!edit ? <p className="muted">Your role can write and test tags but not edit card content.</p> : <CardEditor e={e} items={e.items} mediaUrl={(a) => `/admin/nfc/${e.id}/media/${a}`}
          ops={{ details: bind("details"), note: bind("note"), link: bind("link"), photo: bind("photo"), audio: bind("audio"), remove: bind("remove"), redirect: bind("redirect") }} />}
        <div className="stack" style={{ gap: 20 }}>
          {edit && <section className="card" aria-labelledby="ctl-h">
            <h2 id="ctl-h">Switch on &amp; privacy</h2>
            <ActionForm action={bind("controls")} submit="Save settings">
              <div className="f"><label htmlFor="status">Status</label><select id="status" name="status" defaultValue={e.status}><option value="draft">Draft (not live)</option><option value="active">Live</option><option value="disabled">Switched off</option></select></div>
              <div className="fg2">
                <div className="f"><label htmlFor="startsAt">Opens from (Lagos time)</label><input id="startsAt" name="startsAt" type="datetime-local" defaultValue={toLocal(e.startsAt)} /></div>
                <div className="f"><label htmlFor="expiresAt">Ends (Lagos time)</label><input id="expiresAt" name="expiresAt" type="datetime-local" defaultValue={toLocal(e.expiresAt)} /></div>
              </div>
              <div className="f"><label htmlFor="accessCode">Secret word {e.accessCodeHash ? "(one is set — type to replace)" : "(optional)"}</label><input id="accessCode" name="accessCode" type="text" autoComplete="off" /></div>
              {e.accessCodeHash && <label className="check"><input type="checkbox" name="clearCode" /> Remove the secret word</label>}
              <label className="check"><input type="checkbox" name="buyerCanEdit" defaultChecked={e.buyerCanEdit} /> Buyer can edit from their order page</label>
            </ActionForm>
            <p className="hint" style={{ margin: 0 }}>Viewed {e.viewCount} time{e.viewCount === 1 ? "" : "s"}{e.lastViewedAt ? `, last ${formatDateTime(e.lastViewedAt)}` : ""}.</p>
          </section>}
          <section className="card" aria-labelledby="w-h">
            <h2 id="w-h">Write the physical tag</h2>
            <p className="small" style={{ margin: 0 }}>This is the only thing stored on the chip:</p>
            <code style={{ userSelect: "all", wordBreak: "break-all", background: "#F7EFEB", padding: 8 }}>{url}</code>
            <ol className="small" style={{ margin: 0, paddingLeft: 18 }}>
              <li>On an NFC-capable phone, open <strong>NFC Tools</strong> (Android/iPhone).</li>
              <li>Write → Add a record → <strong>URL/URI</strong> → paste the link above → Write, and hold the card to the phone.</li>
              <li>Test: lock the phone, tap the card, check the right page opens (switch the card to Live first, or you&apos;ll see “Almost ready”).</li>
              <li>Optional: lock the tag (permanent) once tested, so it can&apos;t be overwritten.</li>
            </ol>
            <p className="hint" style={{ margin: 0 }}>Full guide: docs/NFC-TAG-WRITING.md. Print the QR code below on the insert card for phones that can&apos;t tap.</p>
            <div style={{ width: 180, background: "#fff", padding: 6 }} role="img" aria-label="QR code for this card's link" dangerouslySetInnerHTML={{ __html: qr }} />
            <a className="small" href={`/admin/nfc/${e.id}/qr`} download={`llh-card-${e.publicToken.slice(0, 6)}.svg`}>Download QR (SVG)</a>
            {can(s.role, "nfc.write") ? (
              e.tagWrittenAt ? <p className="alert ok small" style={{ margin: 0 }}>Tag written and tested {formatDateTime(e.tagWrittenAt)}.</p>
                : <ActionForm action={bind("written")} submit="I've written and tested the tag" submitClass="btn btn-ghost btn-sm" />
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}

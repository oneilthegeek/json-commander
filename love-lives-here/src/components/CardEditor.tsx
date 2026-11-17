import { ActionForm, type ActionResult } from "./ActionForm";
import type { Experience, NfcItem } from "@/lib/nfc";

type Act = (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
export type CardOps = { details: Act; note: Act; link: Act; photo: Act; audio: Act; remove: Act; redirect: Act };

const WINDOW_LABEL: Record<string, string> = { any: "Any time", morning: "Morning (5am–12pm)", afternoon: "Afternoon (12–5pm)", evening: "Evening (5–9pm)", night: "Night (9pm–5am)" };

/** Editor for a Gold Card / LLH Tag, used by buyers (order page) and staff (admin). */
export function CardEditor({ e, items, ops, mediaUrl }: { e: Experience; items: NfcItem[]; ops: CardOps; mediaUrl: (id: string) => string }) {
  if (e.kind === "llh_tag") {
    return (
      <div className="card">
        <h2>Where should the tag go?</h2>
        <p className="muted small" style={{ margin: 0 }}>When they tap the tag, their phone opens this link. You can change it later — the tag doesn&apos;t need to be replaced.</p>
        <ActionForm action={ops.redirect} submit="Save link">
          <div className="f"><label htmlFor="redirectUrl">Link (playlist, video, photo album…)</label><input id="redirectUrl" name="redirectUrl" type="url" inputMode="url" defaultValue={e.redirectUrl ?? ""} placeholder="https://open.spotify.com/playlist/…" /></div>
        </ActionForm>
      </div>
    );
  }
  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="card">
        <h2>The card</h2>
        <ActionForm action={ops.details} submit="Save">
          <div className="f"><label htmlFor="title">Heading they see</label><input id="title" name="title" type="text" maxLength={120} defaultValue={e.title} /></div>
          <div className="fg2">
            <div className="f"><label htmlFor="recipientName">Their name</label><input id="recipientName" name="recipientName" type="text" maxLength={80} defaultValue={e.recipientName ?? ""} /></div>
            <div className="f"><label htmlFor="fromName">Signed from</label><input id="fromName" name="fromName" type="text" maxLength={80} defaultValue={e.fromName ?? ""} /></div>
          </div>
        </ActionForm>
      </div>

      <div className="card">
        <h2>What&apos;s on it ({items.length})</h2>
        {items.length === 0 ? <p className="muted small">Nothing yet. Add a note below.</p> : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {items.map((i) => (
              <li key={i.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)", display: "flex", gap: 12, justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <span className="badge">{i.kind}{i.kind === "note" ? ` · ${WINDOW_LABEL[i.window]}` : ""}</span>{" "}
                  <strong>{i.title}</strong>
                  {i.body && <p className="small" style={{ whiteSpace: "pre-wrap", margin: "4px 0 0", overflowWrap: "anywhere" }}>{i.body.length > 280 ? i.body.slice(0, 280) + "…" : i.body}</p>}
                  {i.url && <p className="small" style={{ margin: "4px 0 0", overflowWrap: "anywhere" }}>{i.url}</p>}
                  {i.kind === "photo" && i.assetId && /* eslint-disable-next-line @next/next/no-img-element */ <img src={mediaUrl(i.assetId)} alt={i.title ?? "Uploaded photo"} style={{ width: 96, height: 96, objectFit: "cover", marginTop: 6 }} />}
                  {i.kind === "audio" && i.assetId && <audio controls preload="none" src={mediaUrl(i.assetId)} style={{ marginTop: 6, maxWidth: "100%" }} />}
                </div>
                <ActionForm action={ops.remove} submit="Remove" className="" submitClass="link-btn" confirm="Remove this from the card?">
                  <input type="hidden" name="itemId" value={i.id} />
                </ActionForm>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h2>Add a note</h2>
        <p className="hint" style={{ margin: 0 }}>Add different notes for morning, afternoon, evening or night — the card shows the one that matches the time in Lagos when they tap. “Any time” is shown when there&apos;s no note for that part of the day.</p>
        <ActionForm action={ops.note} submit="Add note" resetOnSuccess>
          <div className="fg2">
            <div className="f"><label htmlFor="n-title">Title <span className="opt-l">optional</span></label><input id="n-title" name="title" type="text" maxLength={120} /></div>
            <div className="f"><label htmlFor="n-window">Show it</label><select id="n-window" name="window" defaultValue="any">{Object.entries(WINDOW_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          </div>
          <div className="f"><label htmlFor="n-body">Note</label><textarea id="n-body" name="body" rows={6} maxLength={5000} required /></div>
        </ActionForm>
      </div>

      <div className="card">
        <h2>Add a playlist or link</h2>
        <ActionForm action={ops.link} submit="Add link" resetOnSuccess>
          <div className="fg2">
            <div className="f"><label htmlFor="l-url">Link</label><input id="l-url" name="url" type="url" inputMode="url" placeholder="https://open.spotify.com/…" required /></div>
            <div className="f"><label htmlFor="l-title">Label <span className="opt-l">optional</span></label><input id="l-title" name="title" type="text" maxLength={120} placeholder="Our songs" /></div>
          </div>
        </ActionForm>
      </div>

      <div className="fg2">
        <div className="card">
          <h2>Add a photo</h2>
          <ActionForm action={ops.photo} submit="Upload photo" resetOnSuccess>
            <div className="f"><label htmlFor="p-file">Photo (JPEG, PNG or WebP, up to 6 MB)</label><input id="p-file" name="file" type="file" accept="image/jpeg,image/png,image/webp" required /></div>
            <div className="f"><label htmlFor="p-title">Caption <span className="opt-l">optional</span></label><input id="p-title" name="title" type="text" maxLength={120} /></div>
          </ActionForm>
        </div>
        <div className="card">
          <h2>Add a voice note</h2>
          <ActionForm action={ops.audio} submit="Upload voice note" resetOnSuccess>
            <div className="f"><label htmlFor="a-file">Recording (MP3, M4A, OGG, WAV or WebM, up to 12 MB)</label><input id="a-file" name="file" type="file" accept="audio/*" required /></div>
            <div className="f"><label htmlFor="a-title">Label <span className="opt-l">optional</span></label><input id="a-title" name="title" type="text" maxLength={120} /></div>
          </ActionForm>
        </div>
      </div>
    </div>
  );
}

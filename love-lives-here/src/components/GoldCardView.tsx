import { selectForNow, type Experience, type NfcItem } from "@/lib/nfc";
import type { DayPart } from "@/lib/dates";

const GREETING: Record<DayPart, string> = { morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening", night: "Before you sleep" };

/** The page the recipient sees when they tap the Gold Card. Pure presentation; access is checked by the caller. */
export function GoldCardView({ e, items, mediaUrl, part, preview }: { e: Experience; items: NfcItem[]; mediaUrl: (assetId: string) => string; part?: DayPart; preview?: boolean }) {
  const s = selectForNow(items, part);
  return (
    <div className="gc">
      <main className="gc-card" id="main">
        {preview && <p className="alert warn" style={{ color: "var(--cherry)" }}>Preview — {e.status === "active" ? "this card is live" : "not live yet"}. Showing the {s.part} message.</p>}
        <div className="seal" aria-hidden="true">LLH</div>
        <p className="lab center" style={{ margin: 0 }}>{GREETING[s.part]}{e.recipientName ? `, ${e.recipientName}` : ""}</p>
        <h1>{e.title || "A letter is waiting for you"}</h1>
        {s.note ? (
          <article className="letter" aria-label="Your note">
            {s.note.title && <h2 style={{ fontSize: 22, marginBottom: 10 }}>{s.note.title}</h2>}
            {s.note.body}
            {e.fromName && <p style={{ marginTop: 18, marginBottom: 0, fontFamily: "var(--hand)", fontSize: 24 }}>— {e.fromName}</p>}
          </article>
        ) : <p className="center" style={{ color: "var(--on-dark-muted)" }}>Your message is on its way. Tap again soon.</p>}
        {s.audio.map((a) => a.assetId && (
          <figure key={a.id} style={{ margin: 0 }}>
            <figcaption style={{ marginBottom: 8, color: "var(--on-dark-muted)" }}>{a.title || "A voice note for you"}</figcaption>
            <audio controls preload="none" src={mediaUrl(a.assetId)} />
          </figure>
        ))}
        {s.photos.length > 0 && (
          <div className="photos">
            {s.photos.map((p) => p.assetId && (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.id} src={mediaUrl(p.assetId)} alt={p.title || "A photo for you"} loading="lazy" />
            ))}
          </div>
        )}
        {s.links.map((l) => l.url && (
          <a key={l.id} className="gc-link" href={l.url} rel="noopener noreferrer nofollow" target="_blank">
            <span>{l.title || (l.kind === "playlist" ? "Listen to your playlist" : "Open")}</span><span aria-hidden="true">↗</span>
          </a>
        ))}
        {s.otherNotes.map((n) => (
          <details key={n.id} style={{ borderTop: "1px solid rgba(226,190,120,.3)", paddingTop: 12 }}>
            <summary style={{ cursor: "pointer", color: "var(--gold)" }}>{n.title || "Another note"}</summary>
            <p style={{ whiteSpace: "pre-wrap", color: "var(--on-dark-muted)" }}>{n.body}</p>
          </details>
        ))}
        <p className="tiny center" style={{ color: "var(--on-dark-muted)", marginTop: 24 }}>Made with love by <a href="/" style={{ color: "var(--gold)" }}>Love Lives Here</a>. This page is private — please don&apos;t share the link.</p>
      </main>
    </div>
  );
}

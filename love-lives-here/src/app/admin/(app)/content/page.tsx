import { asc } from "drizzle-orm";
import { requireStaff } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { provider } from "@/lib/newsletter";
import { ActionForm } from "@/components/ActionForm";
import { saveBusiness, saveJournal, saveLegal } from "../actions";

export const metadata = { title: "Site content" };

export default async function Content() {
  await requireStaff("settings.edit");
  const [b, legal, posts] = await Promise.all([getSetting("business"), getSetting("legal"), getDb().select().from(schema.journalPosts).orderBy(asc(schema.journalPosts.sort))]);
  return (
    <div className="stack" style={{ gap: 20, maxWidth: 900 }}>
      <h1 style={{ fontSize: 36 }}>Site content</h1>
      <section className="card" aria-labelledby="b-h">
        <h2 id="b-h">Contact details, hours and claims</h2>
        <p className="hint" style={{ margin: 0 }}>Everything here came from the old site and needs checking. Counts and ratings (marked “needs evidence”) stay hidden until you tick “Verified” — tick only if you can show evidence. Other facts show now; tick “Verified” once confirmed.</p>
        <ActionForm action={saveBusiness} submit="Save">
          <div className="fg2">
            <div className="f"><label htmlFor="whatsapp">WhatsApp (digits with country code)</label><input id="whatsapp" name="whatsapp" type="text" defaultValue={b.whatsapp} /></div>
            <div className="f"><label htmlFor="phoneDisplay">Phone as shown</label><input id="phoneDisplay" name="phoneDisplay" type="text" defaultValue={b.phoneDisplay} /></div>
          </div>
          <div className="f"><label htmlFor="email">Email</label><input id="email" name="email" type="email" defaultValue={b.email} /></div>
          {b.hours.map((h, i) => <div className="fg2" key={i}><div className="f"><label htmlFor={`hd-${i}`}>Days</label><input id={`hd-${i}`} name={`hours-days-${i}`} type="text" defaultValue={h.days} /></div><div className="f"><label htmlFor={`ht-${i}`}>Hours</label><input id={`ht-${i}`} name={`hours-time-${i}`} type="text" defaultValue={h.time} /></div></div>)}
          <div className="f"><label htmlFor="ohs">Opening hours for Google (one per line, e.g. Mo-Fr 08:00-16:00)</label><textarea id="ohs" name="openingHoursSchema" rows={3} defaultValue={b.openingHoursSchema.join("\n")} /></div>
          <fieldset className="f"><legend>Stats strip</legend>
            {b.claims.map((c, i) => <div className="inline-form" key={i}><div className="f"><label htmlFor={`cv-${i}`}>Value</label><input id={`cv-${i}`} name={`claim-value-${i}`} type="text" defaultValue={c.value} /></div><div className="f"><label htmlFor={`cl-${i}`}>Label</label><input id={`cl-${i}`} name={`claim-label-${i}`} type="text" defaultValue={c.label} /></div><label className="check"><input type="checkbox" name={`claim-verified-${i}`} defaultChecked={c.verified} /> Verified</label>{c.needsEvidence ? <span className={`badge ${c.verified ? "ok" : "warn"}`}>{c.verified ? "shown" : "needs evidence — hidden"}</span> : <span className={`badge ${c.verified ? "ok" : "warn"}`}>{c.verified ? "confirmed" : "shown, not yet confirmed"}</span>}</div>)}
          </fieldset>
        </ActionForm>
      </section>
      <section className="card" aria-labelledby="l-h">
        <h2 id="l-h">Policies</h2>
        <p className="hint" style={{ margin: 0 }}>The privacy, terms, refunds and delivery pages are drafts. When a lawyer has reviewed them, tick below to remove the “being finalised” notice. Change the version whenever the wording changes — orders record which version the buyer agreed to.</p>
        <ActionForm action={saveLegal} submit="Save">
          <div className="f"><label htmlFor="version">Version</label><input id="version" name="version" type="text" defaultValue={legal.version} /></div>
          <label className="check"><input type="checkbox" name="reviewed" defaultChecked={legal.reviewed} /> Reviewed by a legal adviser</label>
        </ActionForm>
      </section>
      <section className="card" aria-labelledby="j-h">
        <h2 id="j-h">Dear Lovers cards</h2>
        <p className="hint" style={{ margin: 0 }}>Each card must link to the real individual Substack post (…/p/post-name). Cards without a link stay hidden. Newsletter provider: <strong>{provider()}</strong>.</p>
        {posts.map((p) => (
          <ActionForm key={p.id} action={saveJournal.bind(null, p.id)} submit="Save" className="inline-form" submitClass="btn btn-ghost btn-sm">
            <div className="f" style={{ flex: "0 1 110px" }}><label htmlFor={`jl-${p.id}`}>Label</label><input id={`jl-${p.id}`} name="label" type="text" defaultValue={p.label} /></div>
            <div className="f" style={{ flex: "2 1 200px" }}><label htmlFor={`jt-${p.id}`}>Title</label><input id={`jt-${p.id}`} name="title" type="text" defaultValue={p.title} /></div>
            <div className="f" style={{ flex: "2 1 200px" }}><label htmlFor={`ju-${p.id}`}>Post URL</label><input id={`ju-${p.id}`} name="url" type="url" defaultValue={p.url ?? ""} placeholder="https://….substack.com/p/…" /></div>
            <label className="check" style={{ alignSelf: "center" }}><input type="checkbox" name="published" defaultChecked={p.published} /> Show</label>
          </ActionForm>
        ))}
      </section>
    </div>
  );
}

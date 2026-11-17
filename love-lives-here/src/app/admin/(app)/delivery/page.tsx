import { asc, gte } from "drizzle-orm";
import { requireStaff } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { lagosToday } from "@/lib/dates";
import { ActionForm } from "@/components/ActionForm";
import { saveDay, saveScheduling, saveZone } from "../actions";

export const metadata = { title: "Delivery" };
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ZoneFields({ z }: { z?: typeof schema.deliveryZones.$inferSelect }) {
  const k = z?.id ?? "new";
  return (<>
    {z && <><input type="hidden" name="feeWas" value={z.fee ?? ""} /><input type="hidden" name="modeWas" value={z.mode} /></>}
    <div className="f" style={{ flex: "2 1 160px" }}><label htmlFor={`zn-${k}`}>Area name</label><input id={`zn-${k}`} name="name" type="text" defaultValue={z?.name} required /></div>
    <div className="f" style={{ flex: "2 1 160px" }}><label htmlFor={`za-${k}`}>Areas covered / note</label><input id={`za-${k}`} name="areas" type="text" defaultValue={z?.areas} /></div>
    <div className="f"><label htmlFor={`zm-${k}`}>Fee</label><select id={`zm-${k}`} name="mode" defaultValue={z?.mode ?? "fixed"}><option value="fixed">Fixed</option><option value="quote">We quote</option><option value="pickup">Pickup (free)</option></select></div>
    <div className="f" style={{ flex: "0 1 110px" }}><label htmlFor={`zf-${k}`}>₦</label><input id={`zf-${k}`} name="fee" type="text" inputMode="decimal" defaultValue={z?.fee != null ? String(z.fee / 100) : ""} /></div>
    <div className="f" style={{ flex: "0 1 90px" }}><label htmlFor={`zt-${k}`}>Transit days</label><input id={`zt-${k}`} name="transitDays" type="number" min={0} max={30} defaultValue={z?.transitDays ?? 0} /></div>
    <div className="f" style={{ flex: "0 1 70px" }}><label htmlFor={`zs-${k}`}>Order</label><input id={`zs-${k}`} name="sort" type="number" defaultValue={z?.sort ?? 99} /></div>
    <input type="hidden" name="region" value={z?.region ?? "lagos"} />
    <label className="check" style={{ alignSelf: "center" }}><input type="checkbox" name="active" defaultChecked={z?.active ?? true} /> Active</label>
  </>);
}

export default async function Delivery() {
  await requireStaff("delivery.edit");
  const db = getDb();
  const [zones, sched, days] = await Promise.all([
    db.select().from(schema.deliveryZones).orderBy(asc(schema.deliveryZones.sort)),
    getSetting("scheduling"),
    db.select().from(schema.calendarDays).where(gte(schema.calendarDays.day, lagosToday())).orderBy(asc(schema.calendarDays.day)),
  ]);
  return (
    <div className="stack" style={{ gap: 20 }}>
      <h1 style={{ fontSize: 36 }}>Delivery &amp; scheduling</h1>
      <section className="card" aria-labelledby="z-h">
        <h2 id="z-h">Delivery areas and fees</h2>
        <p className="hint" style={{ margin: 0 }}>Changes apply to new orders immediately. Existing orders keep the fee they were placed with.</p>
        {zones.map((z) => <ActionForm key={z.id} action={saveZone.bind(null, z.id)} submit="Save" className="inline-form" submitClass="btn btn-ghost btn-sm"><ZoneFields z={z} /></ActionForm>)}
        <h3 style={{ marginTop: 10 }}>Add an area</h3>
        <ActionForm action={saveZone.bind(null, null)} submit="Add" className="inline-form" resetOnSuccess><ZoneFields /></ActionForm>
      </section>
      <section className="card" aria-labelledby="s-h">
        <h2 id="s-h">Timing rules (Africa/Lagos)</h2>
        <ActionForm action={saveScheduling} submit="Save rules">
          <div className="fg2">
            <div className="f"><label htmlFor="minLeadDays">Minimum days&apos; notice</label><input id="minLeadDays" name="minLeadDays" type="number" min={0} defaultValue={sched.minLeadDays} /></div>
            <div className="f"><label htmlFor="cutoffHour">Same-day cut-off hour (0–23)</label><input id="cutoffHour" name="cutoffHour" type="number" min={0} max={23} defaultValue={sched.cutoffHour} /></div>
            <div className="f"><label htmlFor="defaultDailyCapacity">Max deliveries per day (blank = no limit)</label><input id="defaultDailyCapacity" name="defaultDailyCapacity" type="number" min={0} defaultValue={sched.defaultDailyCapacity ?? ""} /></div>
            <div className="f"><label htmlFor="maxDaysAhead">Book up to N days ahead</label><input id="maxDaysAhead" name="maxDaysAhead" type="number" min={7} defaultValue={sched.maxDaysAhead} /></div>
          </div>
          <fieldset className="f"><legend>No deliveries on</legend><div className="row">{DAYS.map((d, i) => <label className="check" key={d}><input type="checkbox" name="closedWeekdays" value={i} defaultChecked={sched.closedWeekdays.includes(i)} /> {d}</label>)}</div></fieldset>
        </ActionForm>
      </section>
      <section className="card" aria-labelledby="c-h">
        <h2 id="c-h">Blocked days and special capacity</h2>
        <p className="hint" style={{ margin: 0 }}>Block holidays, or set a limit for busy days like Valentine&apos;s.</p>
        {days.length > 0 && (
          <div className="table-wrap"><table className="t"><thead><tr><th>Date</th><th>Blocked</th><th>Capacity</th><th>Note</th></tr></thead>
            <tbody>{days.map((d) => <tr key={d.day}><td>{d.day}</td><td>{d.blocked ? "Yes" : ""}</td><td>{d.capacity ?? ""}</td><td>{d.note}</td></tr>)}</tbody></table></div>
        )}
        <ActionForm action={saveDay} submit="Save day" className="inline-form" resetOnSuccess>
          <div className="f"><label htmlFor="day">Date</label><input id="day" name="day" type="date" required /></div>
          <div className="f" style={{ flex: "0 1 110px" }}><label htmlFor="capacity">Capacity</label><input id="capacity" name="capacity" type="number" min={0} /></div>
          <div className="f" style={{ flex: "2 1 160px" }}><label htmlFor="cnote">Note shown to customers</label><input id="cnote" name="note" type="text" maxLength={200} /></div>
          <label className="check" style={{ alignSelf: "center" }}><input type="checkbox" name="blocked" /> Blocked</label>
          <label className="check" style={{ alignSelf: "center" }}><input type="checkbox" name="remove" /> Remove override</label>
        </ActionForm>
      </section>
    </div>
  );
}

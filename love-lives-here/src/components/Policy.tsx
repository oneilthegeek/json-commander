import { getSetting } from "@/lib/settings";

export async function Policy({ title, lab, children, updated }: { title: string; lab: string; updated: string; children: React.ReactNode }) {
  const legal = await getSetting("legal");
  return (
    <section className="sec" aria-labelledby="pol-h">
      <div className="box">
        <div className="head"><span className="lab">{lab}</span><h1 id="pol-h">{title}</h1><p className="hint" style={{ margin: 0 }}>Last updated {updated} · version {legal.version}</p></div>
        {!legal.reviewed && <p className="alert warn prose">This policy is being finalised with our advisers. If anything here is unclear, please <a href="/contact">contact us</a> before you order.</p>}
        <div className="prose">{children}</div>
      </div>
    </section>
  );
}

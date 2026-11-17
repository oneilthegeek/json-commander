import Link from "next/link";
import { requireStaff } from "@/lib/auth/session";
import { can, ROLE_LABEL, type Permission } from "@/lib/auth/permissions";
import { signOut } from "./actions";

export const dynamic = "force-dynamic";

const NAV: { href: string; label: string; perm: Permission }[] = [
  { href: "/admin", label: "Dashboard", perm: "orders.view" },
  { href: "/admin/orders", label: "Orders", perm: "orders.view" },
  { href: "/admin/products", label: "Products", perm: "orders.view" },
  { href: "/admin/delivery", label: "Delivery", perm: "delivery.edit" },
  { href: "/admin/messages", label: "Messages", perm: "messages.view" },
  { href: "/admin/outbox", label: "Outbox", perm: "orders.notes" },
  { href: "/admin/payments", label: "Payments", perm: "payments.view" },
  { href: "/admin/content", label: "Site content", perm: "settings.edit" },
  { href: "/admin/staff", label: "Staff", perm: "staff.manage" },
  { href: "/admin/audit", label: "Audit log", perm: "audit.view" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireStaff(undefined, { allowUnenrolled: true });
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="admin-top">
        <div className="box">
          <strong style={{ fontFamily: "var(--display)", fontSize: 20 }}>LLH Admin</strong>
          <nav aria-label="Admin">{NAV.filter((n) => can(s.role, n.perm)).map((n) => <Link key={n.href} href={n.href}>{n.label}</Link>)}</nav>
          <span style={{ marginLeft: "auto", fontSize: 13 }}>{s.name} · {ROLE_LABEL[s.role]}</span>
          <Link href="/admin/security" style={{ fontSize: 13 }}>Security</Link>
          <form action={signOut}><button className="link-btn" style={{ color: "var(--on-dark-muted)" }} type="submit">Sign out</button></form>
        </div>
      </header>
      <main id="main" className="box">{children}</main>
    </>
  );
}

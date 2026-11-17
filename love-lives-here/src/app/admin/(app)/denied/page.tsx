import Link from "next/link";
import { requireStaff } from "@/lib/auth/session";
import { ROLE_LABEL } from "@/lib/auth/permissions";

export const metadata = { title: "No access" };

export default async function Denied({ searchParams }: { searchParams: Promise<{ need?: string }> }) {
  const s = await requireStaff(undefined, { allowUnenrolled: true });
  const { need } = await searchParams;
  return (
    <div className="stack" style={{ maxWidth: 560 }}>
      <h1 style={{ fontSize: 34 }}>You don&apos;t have access to that</h1>
      <p>Your role ({ROLE_LABEL[s.role]}) doesn&apos;t include {need ? <code>{need}</code> : "this"}. Ask the owner if you need it.</p>
      <Link href="/admin">Back to the dashboard</Link>
    </div>
  );
}

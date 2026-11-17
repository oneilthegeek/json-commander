import { redirect } from "next/navigation";
import { getStaff } from "@/lib/auth/session";
import { VerifyForm } from "../../AuthForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Two-factor sign-in" };

export default async function Verify() {
  const s = await getStaff();
  if (!s) redirect("/admin/login");
  if (s.mfaPassed) redirect("/admin");
  return (
    <main id="main" className="box sec stack">
      <h1 style={{ fontSize: 36 }}>Two-factor sign-in</h1>
      <VerifyForm />
    </main>
  );
}

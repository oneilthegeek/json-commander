import { redirect } from "next/navigation";
import { getStaff } from "@/lib/auth/session";
import { LoginForm } from "../AuthForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

export default async function Login() {
  const s = await getStaff();
  if (s && (s.mfaPassed || !s.totpEnabled)) redirect("/admin");
  return (
    <main id="main" className="box sec stack">
      <h1 style={{ fontSize: 36 }}>Love Lives Here · Staff</h1>
      <LoginForm />
      <p className="hint">Forgotten your password? Ask the owner to reset it.</p>
    </main>
  );
}

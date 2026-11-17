"use server";
import { redirect } from "next/navigation";
import { login, verifyMfa } from "@/lib/auth/session";

export async function loginAction(_: { error?: string }, fd: FormData): Promise<{ error?: string }> {
  const r = await login(String(fd.get("email") ?? ""), String(fd.get("password") ?? ""));
  if (!r.ok) return { error: r.error };
  redirect(r.needsMfa ? "/admin/login/verify" : "/admin");
}

export async function verifyAction(_: { error?: string }, fd: FormData): Promise<{ error?: string }> {
  const ok = await verifyMfa(String(fd.get("code") ?? ""));
  if (!ok) return { error: "That code didn't work. Use the newest code from your authenticator app." };
  redirect("/admin");
}

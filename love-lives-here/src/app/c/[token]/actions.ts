"use server";
import { redirect } from "next/navigation";
import { checkAccessCode, getExperienceByToken } from "@/lib/nfc";
import { unlock } from "@/lib/nfc-access";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/auth/session";

export async function unlockCard(_: { error: string }, fd: FormData): Promise<{ error: string }> {
  const token = String(fd.get("token") ?? "");
  const rl = await rateLimit(`unlock:${token}:${await clientIp()}`, 8, 15 * 60);
  // Also cap guesses per card across all addresses, so rotating IPs can't brute-force a short secret word.
  const rlCard = await rateLimit(`unlock-card:${token}`, 40, 60 * 60);
  if (!rl.ok || !rlCard.ok) return { error: "Too many tries. Please wait a while and try again." };
  const e = await getExperienceByToken(token);
  if (!e || e.status !== "active") return { error: "This card isn't available." };
  if (!(await checkAccessCode(e, String(fd.get("code") ?? "")))) return { error: "That's not quite it. Try again." };
  await unlock(e.id);
  redirect(`/c/${token}`);
}

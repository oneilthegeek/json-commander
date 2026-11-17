import "server-only";
import { cookies } from "next/headers";
import { sign, verifySigned } from "./tokens";

const name = (id: string) => `llh_card_${id.slice(0, 8)}`;

export async function isUnlocked(experienceId: string): Promise<boolean> {
  const v = (await cookies()).get(name(experienceId))?.value;
  return verifySigned(v) === experienceId;
}

export async function unlock(experienceId: string) {
  (await cookies()).set(name(experienceId), sign(experienceId, 30 * 24 * 3600), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/c", maxAge: 30 * 24 * 3600,
  });
}

// Password rules and storage shared by the account commands.
import { randomBytes } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { account, user } from "@/db/schema";
import type { Deps } from "../context";
import { InvalidInput } from "../errors";

export const MIN_PASSWORD_LENGTH = 10;

/** An initial or Admin-reset password: 12 readable characters (no 0/O/1/l/I), easy to read out or copy. */
export function generatePassword(): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(randomBytes(12), (b) => alphabet[b % alphabet.length]).join("");
}

export function checkNewPassword(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) throw new InvalidInput("errors.passwordTooShort");
}

type Tx = Parameters<Parameters<Deps["db"]["transaction"]>[0]>[0];

/** Replaces the user's password and clears any first-login change requirement. */
export async function setPassword(tx: Tx, now: Date, userId: string, password: string) {
  const hash = await hashPassword(password);
  await tx
    .update(account)
    .set({ password: hash, updatedAt: now })
    .where(and(eq(account.userId, userId), eq(account.providerId, "credential")));
  await tx.update(user).set({ mustChangePassword: false, updatedAt: now }).where(eq(user.id, userId));
}

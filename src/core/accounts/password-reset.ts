// Forgotten-password reset by email. System commands: the person isn't logged in.
//
//   requestPasswordReset: emails a one-time link (valid for an hour) through the Mailer.
//   resetPassword: sets the new password from that link and ends every session.
import { randomUUID } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { session, user, verification } from "@/db/schema";
import type { Deps } from "../context";
import { InvalidResetToken } from "../errors";
import { normaliseEmail } from "./identifiers";
import { checkNewPassword, setPassword } from "./passwords";
import { hashToken, newToken } from "./tokens";

export const RESET_LINK_TTL_MS = 60 * 60 * 1000;

const PREFIX = "password-reset:";

export type RequestPasswordResetInput = {
  email: string;
  /** The reset page's absolute URL; the token is appended as ?token=. */
  linkBase: string;
};

/** Does nothing visible for an unknown address or a disabled login, so it reveals nothing. */
export async function requestPasswordReset(
  { db, clock, mailer }: Deps,
  input: RequestPasswordResetInput,
): Promise<void> {
  const email = normaliseEmail(input.email);
  const [found] = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(and(eq(user.email, email), isNull(user.disabledAt)))
    .limit(1);
  if (!found?.email) return;

  const token = newToken();
  const now = clock.now();
  await db.insert(verification).values({
    id: randomUUID(),
    identifier: PREFIX + hashToken(token),
    value: found.id,
    expiresAt: new Date(now.getTime() + RESET_LINK_TTL_MS),
    createdAt: now,
    updatedAt: now,
  });

  const link = `${input.linkBase}?token=${token}`;
  await mailer.send({
    to: found.email,
    subject: "Reset your password",
    text:
      `Someone asked to reset the password for your School LMS account.\n\n` +
      `Open this link within an hour to choose a new password:\n${link}\n\n` +
      `If it wasn't you, ignore this email and your password stays the same.`,
  });
}

export async function resetPassword(
  { db, clock }: Deps,
  input: { token: string; newPassword: string },
): Promise<void> {
  checkNewPassword(input.newPassword);
  const now = clock.now();

  await db.transaction(async (tx) => {
    // Deleting the link as we read it makes it single-use, even under concurrent requests.
    const [link] = await tx
      .delete(verification)
      .where(and(eq(verification.identifier, PREFIX + hashToken(input.token)), gt(verification.expiresAt, now)))
      .returning({ userId: verification.value });
    if (!link) throw new InvalidResetToken();

    await setPassword(tx, now, link.userId, input.newPassword);
    await tx.delete(session).where(eq(session.userId, link.userId));
  });
}

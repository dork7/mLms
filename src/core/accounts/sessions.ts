// Login sessions. The raw token lives only in the person's cookie (see tokens.ts).
import { randomUUID } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { session, user } from "@/db/schema";
import type { Actor, Deps, Role } from "../context";
import { hashToken, newToken } from "./tokens";

/** A session ends after this long without use. Each use pushes the expiry out again. */
export const SESSION_IDLE_TIMEOUT_MS = 8 * 60 * 60 * 1000;

type Writer = Pick<Deps["db"], "insert">;

/** Starts a session for a user who has just proven who they are. Returns the raw token. */
export async function startSession(db: Writer, clock: Deps["clock"], userId: string) {
  const token = newToken();
  const now = clock.now();
  await db.insert(session).values({
    id: randomUUID(),
    token: hashToken(token),
    userId,
    expiresAt: new Date(now.getTime() + SESSION_IDLE_TIMEOUT_MS),
    createdAt: now,
    updatedAt: now,
  });
  return token;
}

export type SessionActor = { actor: Actor; mustChangePassword: boolean };

/**
 * Who a session token belongs to, or null if it is unknown, timed out or the login
 * is disabled. Using a session pushes its idle timeout out again.
 */
export async function sessionActor({ db, clock }: Deps, token: string): Promise<SessionActor | null> {
  const now = clock.now();
  const [found] = await db
    .select({
      sessionId: session.id,
      userId: user.id,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    })
    .from(session)
    .innerJoin(user, eq(user.id, session.userId))
    .where(and(eq(session.token, hashToken(token)), gt(session.expiresAt, now), isNull(user.disabledAt)))
    .limit(1);
  if (!found) return null;

  await db
    .update(session)
    .set({ expiresAt: new Date(now.getTime() + SESSION_IDLE_TIMEOUT_MS), updatedAt: now })
    .where(eq(session.id, found.sessionId));
  return {
    actor: { role: found.role as Role, userId: found.userId },
    mustChangePassword: found.mustChangePassword,
  };
}

export async function logOut({ db }: Deps, token: string): Promise<void> {
  await db.delete(session).where(eq(session.token, hashToken(token)));
}

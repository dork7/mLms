// Staff log in with their email or phone and a password. A system command: there
// is no acting person yet. Returns a session token for the web layer's cookie.
import { verifyPassword } from "better-auth/crypto";
import { and, count, eq, gt } from "drizzle-orm";
import { account, failedLogin, user } from "@/db/schema";
import type { Actor, Deps, Role } from "../context";
import { LoginFailed, TooManyLoginAttempts } from "../errors";
import { parseIdentifier } from "./identifiers";
import { startSession } from "./sessions";

/** This many failed logins for one identifier within the window locks it for the window. */
export const MAX_FAILED_LOGINS = 5;
export const FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000;

export type LogInInput = { identifier: string; password: string };

export type LoggedIn = { token: string; actor: Actor; mustChangePassword: boolean };

export async function logIn({ db, clock }: Deps, input: LogInInput): Promise<LoggedIn> {
  const id = parseIdentifier(input.identifier);
  const key = "email" in id ? id.email : id.phone;
  const now = clock.now();

  const [{ recent }] = await db
    .select({ recent: count() })
    .from(failedLogin)
    .where(
      and(
        eq(failedLogin.identifier, key),
        gt(failedLogin.at, new Date(now.getTime() - FAILED_LOGIN_WINDOW_MS)),
      ),
    );
  if (recent >= MAX_FAILED_LOGINS) throw new TooManyLoginAttempts();

  const [found] = await db
    .select({
      userId: user.id,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      disabledAt: user.disabledAt,
      passwordHash: account.password,
    })
    .from(user)
    .innerJoin(account, and(eq(account.userId, user.id), eq(account.providerId, "credential")))
    .where("email" in id ? eq(user.email, id.email) : eq(user.phone, id.phone))
    .limit(1);

  const ok =
    !!found?.passwordHash &&
    (await verifyPassword({ hash: found.passwordHash, password: input.password }));
  // A disabled login fails exactly like a wrong password, so it reveals nothing.
  if (!found || !ok || found.disabledAt) {
    await db.insert(failedLogin).values({ identifier: key, at: now });
    throw new LoginFailed();
  }

  await db.delete(failedLogin).where(eq(failedLogin.identifier, key));
  const token = await startSession(db, clock, found.userId);
  return {
    token,
    actor: { role: found.role as Role, userId: found.userId },
    mustChangePassword: found.mustChangePassword,
  };
}

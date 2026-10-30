// Staff log in with their email or phone, Students with their Student Number, and
// everyone with a password. A system command: there is no acting person yet.
// Returns a session token for the web layer's cookie.
import { verifyPassword } from "better-auth/crypto";
import { and, count, eq, gt, inArray, type SQL } from "drizzle-orm";
import { account, failedLogin, student, user } from "@/db/schema";
import type { Actor, Deps, Role } from "../context";
import { LoginFailed, TooManyLoginAttempts } from "../errors";
import { parseIdentifier, rateLimitKeys } from "./identifiers";
import { startSession } from "./sessions";

/** This many failed logins for one identifier within the window locks it for the window. */
export const MAX_FAILED_LOGINS = 5;
export const FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000;

export type LogInInput = { identifier: string; password: string };

export type LoggedIn = { token: string; actor: Actor; mustChangePassword: boolean };

export async function logIn({ db, clock }: Deps, input: LogInInput): Promise<LoggedIn> {
  const id = parseIdentifier(input.identifier);
  const keys = rateLimitKeys(id);
  const now = clock.now();

  const perKey = await db
    .select({ recent: count() })
    .from(failedLogin)
    .where(
      and(
        inArray(failedLogin.identifier, keys),
        gt(failedLogin.at, new Date(now.getTime() - FAILED_LOGIN_WINDOW_MS)),
      ),
    )
    .groupBy(failedLogin.identifier);
  if (perKey.some(({ recent }) => recent >= MAX_FAILED_LOGINS)) throw new TooManyLoginAttempts();

  const findUser = async (match: SQL) => {
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
      .leftJoin(student, eq(student.userId, user.id))
      .where(match)
      .limit(1);
    return found;
  };
  // A Student Number wins over a phone that happens to look the same; staff can still use email.
  const found =
    "email" in id
      ? await findUser(eq(user.email, id.email))
      : ((await findUser(eq(student.studentNumber, id.studentNumber))) ??
        (id.phone ? await findUser(eq(user.phone, id.phone)) : undefined));

  const ok =
    !!found?.passwordHash &&
    (await verifyPassword({ hash: found.passwordHash, password: input.password }));
  // A disabled login fails exactly like a wrong password, so it reveals nothing.
  if (!found || !ok || found.disabledAt) {
    await db.insert(failedLogin).values(keys.map((identifier) => ({ identifier, at: now })));
    throw new LoginFailed();
  }

  await db.delete(failedLogin).where(inArray(failedLogin.identifier, keys));
  const token = await startSession(db, clock, found.userId);
  return {
    token,
    actor: { role: found.role as Role, userId: found.userId },
    mustChangePassword: found.mustChangePassword,
  };
}

// How pages, server actions and route handlers call the application layer:
//
//   const dashboard = await asCurrentActor((ctx) => getAdminDashboard(ctx));
//
// It authenticates from the session cookie (redirecting to /login if there is no
// valid session, or to /change-password while the initial password is unchanged),
// builds the Ctx from the session's user, and calls the layer. Nothing else belongs here.
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sessionActor, type SessionActor } from "@/core/accounts/sessions";
import { as, type Actor, type Ctx } from "@/core/context";
import { appDeps } from "./deps";

export const SESSION_COOKIE = "lms_session";

/** The logged-in session, or null. Reading it marks the route dynamic. */
export async function currentSession(): Promise<SessionActor | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value; // first: marks the route dynamic
  if (!token) return null;
  return sessionActor(appDeps(), token);
}

/** The acting person, or null if not logged in or their password must be changed first. */
export async function currentActor(): Promise<Actor | null> {
  const session = await currentSession();
  return session && !session.mustChangePassword ? session.actor : null;
}

export async function asCurrentActor<T>(call: (ctx: Ctx) => Promise<T>): Promise<T> {
  const session = await currentSession();
  if (!session) redirect("/login");
  if (session.mustChangePassword) redirect("/change-password");
  return call(as(appDeps(), session.actor));
}

/** For the password change itself, which a first-login session may do. */
export async function asCurrentSessionActor<T>(call: (ctx: Ctx) => Promise<T>): Promise<T> {
  const session = await currentSession();
  if (!session) redirect("/login");
  return call(as(appDeps(), session.actor));
}

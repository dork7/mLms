// How pages, server actions and route handlers call the application layer:
//
//   const dashboard = await asCurrentActor((ctx) => getAdminDashboard(ctx));
//
// It authenticates (redirecting to /login if there is no session), builds the
// Ctx from the session's user, and calls the layer. Nothing else belongs here.
import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { as, type Actor, type Ctx, type Role } from "@/core/context";
import { auth } from "./auth";
import { appDeps } from "./deps";

export async function currentActor(): Promise<Actor | null> {
  const requestHeaders = await headers(); // first: marks the route dynamic
  const session = await auth().api.getSession({ headers: requestHeaders });
  if (!session) return null;
  return { role: session.user.role as Role, userId: session.user.id };
}

export async function asCurrentActor<T>(call: (ctx: Ctx) => Promise<T>): Promise<T> {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  return call(as(appDeps(), actor));
}

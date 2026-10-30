// The Admin disables (or re-enables) a person's login. Nothing is deleted: the
// person and their records stay, they just can't log in. Disabling ends their sessions.
import { eq } from "drizzle-orm";
import { session, user } from "@/db/schema";
import { requireAdmin } from "../access";
import type { Ctx } from "../context";
import { InvalidInput } from "../errors";

export async function disableLogin(ctx: Ctx, input: { userId: string }): Promise<void> {
  requireAdmin(ctx.actor);
  if (input.userId === ctx.actor.userId) throw new InvalidInput("errors.cannotDisableSelf");

  const now = ctx.clock.now();
  await ctx.db.transaction(async (tx) => {
    await tx.update(user).set({ disabledAt: now, updatedAt: now }).where(eq(user.id, input.userId));
    await tx.delete(session).where(eq(session.userId, input.userId));
  });
}

export async function enableLogin(ctx: Ctx, input: { userId: string }): Promise<void> {
  requireAdmin(ctx.actor);
  const now = ctx.clock.now();
  await ctx.db.update(user).set({ disabledAt: null, updatedAt: now }).where(eq(user.id, input.userId));
}

// Whether Report Cards show a rank within the Issuing Class: one school-wide switch,
// off until the Admin turns it on.
import { schoolSettings } from "@/db/schema";
import { requireAdmin } from "../access";
import type { Ctx } from "../context";

export async function setRankEnabled(ctx: Ctx, enabled: boolean): Promise<void> {
  requireAdmin(ctx.actor);
  await ctx.db
    .insert(schoolSettings)
    .values({ id: 1, rankEnabled: enabled })
    .onConflictDoUpdate({ target: schoolSettings.id, set: { rankEnabled: enabled } });
}

export async function getRankEnabled(ctx: Ctx): Promise<boolean> {
  requireAdmin(ctx.actor);
  return rankIsEnabled(ctx.db);
}

/** No access check: for callers that already checked. */
export async function rankIsEnabled(db: Ctx["db"]): Promise<boolean> {
  const [row] = await db.select({ enabled: schoolSettings.rankEnabled }).from(schoolSettings);
  return row?.enabled ?? false;
}

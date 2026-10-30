// The number of Periods in the school day (N). Periods are numbered 1..N.
import { schoolSettings } from "@/db/schema";
import { requireAdmin, requireRole } from "../access";
import type { Ctx } from "../context";
import { InvalidPeriodsPerDay } from "../errors";

const MAX_PERIODS_PER_DAY = 20;

export async function setPeriodsPerDay(ctx: Ctx, periodsPerDay: number): Promise<void> {
  requireAdmin(ctx.actor);
  if (!Number.isInteger(periodsPerDay) || periodsPerDay < 1 || periodsPerDay > MAX_PERIODS_PER_DAY) {
    throw new InvalidPeriodsPerDay();
  }

  await ctx.db
    .insert(schoolSettings)
    .values({ id: 1, periodsPerDay })
    .onConflictDoUpdate({ target: schoolSettings.id, set: { periodsPerDay } });
}

/** N, or null until the Admin has set it. */
export async function getPeriodsPerDay(ctx: Ctx): Promise<number | null> {
  requireRole(ctx.actor, "admin", "teacher");

  const [row] = await ctx.db.select({ n: schoolSettings.periodsPerDay }).from(schoolSettings);
  return row?.n ?? null;
}

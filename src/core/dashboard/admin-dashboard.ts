import { eq } from "drizzle-orm";
import { user } from "@/db/schema";
import { requireAdmin } from "../access";
import type { Ctx } from "../context";

export type AdminDashboard = { adminName: string; today: string };

export async function getAdminDashboard(ctx: Ctx): Promise<AdminDashboard> {
  requireAdmin(ctx.actor);

  const [me] = await ctx.db
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, ctx.actor.userId));
  return { adminName: me.name, today: ctx.clock.today() };
}

// The Admin's list of Teachers, including disabled ones, by name.
import { asc, eq } from "drizzle-orm";
import { user } from "@/db/schema";
import { requireAdmin } from "../access";
import type { Ctx } from "../context";

export type TeacherRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  disabled: boolean;
};

export async function listTeachers(ctx: Ctx): Promise<TeacherRow[]> {
  requireAdmin(ctx.actor);
  const rows = await ctx.db
    .select({ id: user.id, name: user.name, email: user.email, phone: user.phone, disabledAt: user.disabledAt })
    .from(user)
    .where(eq(user.role, "teacher"))
    .orderBy(asc(user.name), asc(user.id));
  return rows.map(({ disabledAt, ...row }) => ({ ...row, disabled: disabledAt !== null }));
}

// The Admin's list of Students, including disabled ones, by name.
import { asc, eq } from "drizzle-orm";
import { student, user } from "@/db/schema";
import { requireAdmin } from "../access";
import type { Ctx } from "../context";

export type StudentRow = {
  id: string;
  name: string;
  studentNumber: string;
  disabled: boolean;
};

export async function listStudents(ctx: Ctx): Promise<StudentRow[]> {
  requireAdmin(ctx.actor);
  const rows = await ctx.db
    .select({ id: user.id, name: user.name, studentNumber: student.studentNumber, disabledAt: user.disabledAt })
    .from(student)
    .innerJoin(user, eq(user.id, student.userId))
    .orderBy(asc(user.name), asc(user.id));
  return rows.map(({ disabledAt, ...row }) => ({ ...row, disabled: disabledAt !== null }));
}

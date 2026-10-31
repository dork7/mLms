// Classes: one cohort of a Grade in an Academic Year (such as 7-A), each with one
// Class Teacher. Class names are trimmed and unique within an Academic Year.
import { and, asc, desc, eq, type SQL, sql } from "drizzle-orm";
import { academicYear, grade, schoolClass, user } from "@/db/schema";
import { requireAdmin, requireCanSeeClass, requireRole } from "../access";
import type { Ctx } from "../context";
import { InvalidInput, isUniqueViolation, NameTaken, NotFound } from "../errors";
import { requireOpenYear } from "../school/closed-year";

export type CreateClassInput = {
  academicYearId: number;
  gradeId: number;
  name: string;
  classTeacherId: string;
};

export type ClassRow = {
  id: number;
  name: string;
  academicYearId: number;
  academicYear: string;
  gradeId: number;
  grade: string;
  classTeacherId: string;
  classTeacher: string;
  /** Whether the Academic Year is Closed, so nothing in this Class can change. */
  yearClosed: boolean;
};

export async function createClass(ctx: Ctx, input: CreateClassInput): Promise<{ id: number }> {
  requireAdmin(ctx.actor);
  const name = input.name.trim();
  if (!name) throw new InvalidInput("errors.nameRequired");
  await requireTeacher(ctx, input.classTeacherId);
  try {
    return await ctx.db.transaction(async (tx) => {
      await requireOpenYear(tx, { academicYearId: input.academicYearId });
      const [row] = await tx
        .insert(schoolClass)
        .values({ ...input, name })
        .returning({ id: schoolClass.id });
      return row;
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new NameTaken();
    throw err;
  }
}

/** Refuses anyone but an existing Teacher as a Class Teacher or Subject Teacher. */
export async function requireTeacher(ctx: Ctx, userId: string): Promise<void> {
  const [found] = await ctx.db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.id, userId), eq(user.role, "teacher")));
  if (!found) throw new InvalidInput("errors.notATeacher");
}

/** Every Class, newest Academic Year first, then by Grade and name. Admin-only. */
export async function listClasses(ctx: Ctx): Promise<ClassRow[]> {
  requireAdmin(ctx.actor);
  return selectClasses(ctx);
}

/** The Classes the acting Teacher is Class Teacher of. */
export async function listMyClasses(ctx: Ctx): Promise<ClassRow[]> {
  requireRole(ctx.actor, "teacher");
  return selectClasses(ctx, eq(schoolClass.classTeacherId, ctx.actor.userId));
}

/** One Class: for the Admin and its Class Teacher. */
export async function getClass(ctx: Ctx, input: { classId: number }): Promise<ClassRow> {
  await requireCanSeeClass(ctx, input.classId);
  const [row] = await selectClasses(ctx, eq(schoolClass.id, input.classId));
  if (!row) throw new NotFound();
  return row;
}

function selectClasses(ctx: Ctx, where?: SQL): Promise<ClassRow[]> {
  return ctx.db
    .select({
      id: schoolClass.id,
      name: schoolClass.name,
      academicYearId: schoolClass.academicYearId,
      academicYear: academicYear.name,
      gradeId: schoolClass.gradeId,
      grade: grade.name,
      classTeacherId: schoolClass.classTeacherId,
      classTeacher: user.name,
      yearClosed: sql<boolean>`${academicYear.closedAt} is not null`,
    })
    .from(schoolClass)
    .innerJoin(academicYear, eq(academicYear.id, schoolClass.academicYearId))
    .innerJoin(grade, eq(grade.id, schoolClass.gradeId))
    .innerJoin(user, eq(user.id, schoolClass.classTeacherId))
    .where(where)
    .orderBy(desc(academicYear.startDate), asc(grade.name), asc(schoolClass.name));
}

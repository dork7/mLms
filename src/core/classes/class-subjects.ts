// Class Subjects: a Subject as taught to one Class by one Subject Teacher, such as
// Math for 7-A. A Class has each Subject at most once. Who may see which Class
// Subject is decided in ../access.ts.
import { asc, eq, type SQL } from "drizzle-orm";
import { academicYear, classSubject, grade, schoolClass, subject, user } from "@/db/schema";
import { requireAdmin, requireCanSeeClass, requireCanSeeClassSubject, requireRole } from "../access";
import type { Ctx } from "../context";
import { ClassSubjectExists, isUniqueViolation, NotFound } from "../errors";
import { requireTeacher } from "./classes";

export type ClassSubjectRow = {
  id: number;
  classId: number;
  class: string;
  gradeId: number;
  grade: string;
  academicYearId: number;
  academicYear: string;
  subjectId: number;
  subject: string;
  teacherId: string;
  teacher: string;
};

export type CreateClassSubjectInput = { classId: number; subjectId: number; teacherId: string };

export async function createClassSubject(ctx: Ctx, input: CreateClassSubjectInput): Promise<{ id: number }> {
  requireAdmin(ctx.actor);
  await requireTeacher(ctx, input.teacherId);
  try {
    const [row] = await ctx.db.insert(classSubject).values(input).returning({ id: classSubject.id });
    return row;
  } catch (err) {
    if (isUniqueViolation(err)) throw new ClassSubjectExists();
    throw err;
  }
}

/** Hands a Class Subject to another Subject Teacher (e.g. a staff change mid-year). */
export async function reassignSubjectTeacher(
  ctx: Ctx,
  input: { classSubjectId: number; teacherId: string },
): Promise<void> {
  requireAdmin(ctx.actor);
  await requireTeacher(ctx, input.teacherId);
  const updated = await ctx.db
    .update(classSubject)
    .set({ teacherId: input.teacherId })
    .where(eq(classSubject.id, input.classSubjectId))
    .returning({ id: classSubject.id });
  if (updated.length === 0) throw new NotFound();
}

/** Every Class Subject of one Class, by Subject name: for the Admin and the Class Teacher. */
export async function listClassSubjects(ctx: Ctx, input: { classId: number }): Promise<ClassSubjectRow[]> {
  await requireCanSeeClass(ctx, input.classId);
  return selectClassSubjects(ctx, eq(classSubject.classId, input.classId));
}

/** Every Class Subject in one Academic Year, by Class then Subject: for the Admin. */
export async function listYearClassSubjects(
  ctx: Ctx,
  input: { academicYearId: number },
): Promise<ClassSubjectRow[]> {
  requireAdmin(ctx.actor);
  return selectClassSubjects(ctx, eq(schoolClass.academicYearId, input.academicYearId));
}

/** The Class Subjects the acting Teacher teaches, by Class then Subject. */
export async function listMyClassSubjects(ctx: Ctx): Promise<ClassSubjectRow[]> {
  requireRole(ctx.actor, "teacher");
  return selectClassSubjects(ctx, eq(classSubject.teacherId, ctx.actor.userId));
}

export async function getClassSubject(ctx: Ctx, input: { classSubjectId: number }): Promise<ClassSubjectRow> {
  await requireCanSeeClassSubject(ctx, input.classSubjectId);
  const [row] = await selectClassSubjects(ctx, eq(classSubject.id, input.classSubjectId));
  if (!row) throw new NotFound();
  return row;
}

function selectClassSubjects(ctx: Ctx, where: SQL): Promise<ClassSubjectRow[]> {
  return ctx.db
    .select({
      id: classSubject.id,
      classId: classSubject.classId,
      class: schoolClass.name,
      gradeId: schoolClass.gradeId,
      grade: grade.name,
      academicYearId: schoolClass.academicYearId,
      academicYear: academicYear.name,
      subjectId: classSubject.subjectId,
      subject: subject.name,
      teacherId: classSubject.teacherId,
      teacher: user.name,
    })
    .from(classSubject)
    .innerJoin(schoolClass, eq(schoolClass.id, classSubject.classId))
    .innerJoin(grade, eq(grade.id, schoolClass.gradeId))
    .innerJoin(academicYear, eq(academicYear.id, schoolClass.academicYearId))
    .innerJoin(subject, eq(subject.id, classSubject.subjectId))
    .innerJoin(user, eq(user.id, classSubject.teacherId))
    .where(where)
    .orderBy(asc(schoolClass.name), asc(subject.name));
}

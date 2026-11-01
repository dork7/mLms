// Enrollment: a Student's membership of a Class for a date range (inclusive at both
// ends; an open Enrollment has no end date). A Student has at most one open
// Enrollment. Moving Class ends the open one the day before the move date and
// starts the next on it, so the two never overlap.
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { academicYear, enrollment, grade, schoolClass, student, user } from "@/db/schema";
import { requireAdmin, requireCanSeeClassRoster } from "../access";
import { enrollmentCovers } from "./roster-condition";
import { type ClassRow, listClasses } from "../classes/classes";
import type { Ctx } from "../context";
import { dayBefore } from "../dates";
import { AlreadyEnrolled, InvalidInput, isUniqueViolation, NotEnrolled, NotFound } from "../errors";
import { requireEnrollmentNotFrozen } from "../report-cards/publications";
import { requireOpenYear } from "../school/closed-year";

export type RosterRow = {
  studentId: string;
  name: string;
  studentNumber: string;
  startDate: string;
  endDate: string | null;
};

export async function enrollStudent(
  ctx: Ctx,
  input: { studentId: string; classId: number; startDate: string },
): Promise<{ id: number }> {
  requireAdmin(ctx.actor);
  const target = await classYear(ctx.db, input.classId);
  if (!isDate(input.startDate) || input.startDate < target.yearStart || input.startDate > target.yearEnd) {
    throw new InvalidInput("errors.enrollmentDateOutsideYear");
  }
  const [found] = await ctx.db
    .select({ id: student.userId })
    .from(student)
    .where(eq(student.userId, input.studentId));
  if (!found) throw new NotFound("no such Student");
  try {
    return await ctx.db.transaction(async (tx) => {
      await requireOpenYear(tx, { academicYearId: target.academicYearId });
      await requireEnrollmentNotFrozen(tx, [input.classId], dayBefore(input.startDate));
      const [row] = await tx
        .insert(enrollment)
        .values({ studentId: input.studentId, classId: input.classId, startDate: input.startDate })
        .returning({ id: enrollment.id });
      return row;
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new AlreadyEnrolled();
    throw err;
  }
}

/**
 * Moves a Student with an open Enrollment to another Class of the same Grade and
 * Academic Year: the open Enrollment ends the day before `date`, and the new one
 * starts on `date`.
 */
export async function moveStudent(
  ctx: Ctx,
  input: { studentId: string; classId: number; date: string },
): Promise<{ id: number }> {
  requireAdmin(ctx.actor);
  return ctx.db.transaction(async (tx) => {
    const [open] = await tx
      .select({ id: enrollment.id, classId: enrollment.classId, startDate: enrollment.startDate })
      .from(enrollment)
      .where(and(eq(enrollment.studentId, input.studentId), isNull(enrollment.endDate)))
      .for("update");
    if (!open) throw new NotEnrolled();
    const from = await classYear(tx, open.classId);
    const to = await classYear(tx, input.classId);
    if (to.id === from.id) throw new InvalidInput("errors.moveToSameClass");
    if (to.gradeId !== from.gradeId || to.academicYearId !== from.academicYearId) {
      throw new InvalidInput("errors.moveNeedsSameGrade");
    }
    if (!isDate(input.date) || input.date <= open.startDate || input.date > to.yearEnd) {
      throw new InvalidInput("errors.moveDateInvalid");
    }
    await requireOpenYear(tx, { academicYearId: to.academicYearId });
    await requireEnrollmentNotFrozen(tx, [from.id, to.id], dayBefore(input.date));
    await tx.update(enrollment).set({ endDate: dayBefore(input.date) }).where(eq(enrollment.id, open.id));
    const [row] = await tx
      .insert(enrollment)
      .values({ studentId: input.studentId, classId: input.classId, startDate: input.date })
      .returning({ id: enrollment.id });
    return row;
  });
}

export type EnrollmentChoices = { mode: "enroll" | "move"; classes: ClassRow[] };

/**
 * Which Classes the Admin can put a Student in right now. With an open Enrollment they
 * can only move: another Class of the same Grade and Academic Year. Otherwise they can
 * enroll in any Class. Closed years are left out either way.
 */
export async function enrollmentChoices(ctx: Ctx, input: { studentId: string }): Promise<EnrollmentChoices> {
  requireAdmin(ctx.actor);
  const classes = (await listClasses(ctx)).filter((c) => !c.yearClosed);
  const [open] = await ctx.db
    .select({ classId: enrollment.classId, gradeId: schoolClass.gradeId, academicYearId: schoolClass.academicYearId })
    .from(enrollment)
    .innerJoin(schoolClass, eq(schoolClass.id, enrollment.classId))
    .where(and(eq(enrollment.studentId, input.studentId), isNull(enrollment.endDate)));
  if (!open) return { mode: "enroll", classes };
  return {
    mode: "move",
    classes: classes.filter(
      (c) => c.id !== open.classId && c.gradeId === open.gradeId && c.academicYearId === open.academicYearId,
    ),
  };
}

export type Tx = Parameters<Parameters<Ctx["db"]["transaction"]>[0]>[0];

/** A Class with its Grade and Academic Year dates, or NotFound. */
async function classYear(db: Ctx["db"] | Tx, classId: number) {
  if (!Number.isSafeInteger(classId)) throw new NotFound();
  const [found] = await db
    .select({
      id: schoolClass.id,
      gradeId: schoolClass.gradeId,
      academicYearId: schoolClass.academicYearId,
      yearStart: academicYear.startDate,
      yearEnd: academicYear.endDate,
    })
    .from(schoolClass)
    .innerJoin(academicYear, eq(academicYear.id, schoolClass.academicYearId))
    .where(eq(schoolClass.id, classId));
  if (!found) throw new NotFound();
  return found;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isDate(value: string): boolean {
  return ISO_DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export type EnrollmentRow = {
  id: number;
  classId: number;
  class: string;
  grade: string;
  academicYear: string;
  startDate: string;
  endDate: string | null;
};

/**
 * A Student's Enrollments, oldest first. No access check: callers (the Student
 * profile) check `requireCanSeeStudent` first.
 */
export function enrollmentHistory(db: Ctx["db"], studentId: string): Promise<EnrollmentRow[]> {
  return db
    .select({
      id: enrollment.id,
      classId: schoolClass.id,
      class: schoolClass.name,
      grade: grade.name,
      academicYear: academicYear.name,
      startDate: enrollment.startDate,
      endDate: enrollment.endDate,
    })
    .from(enrollment)
    .innerJoin(schoolClass, eq(schoolClass.id, enrollment.classId))
    .innerJoin(grade, eq(grade.id, schoolClass.gradeId))
    .innerJoin(academicYear, eq(academicYear.id, schoolClass.academicYearId))
    .where(eq(enrollment.studentId, studentId))
    .orderBy(asc(enrollment.startDate), asc(enrollment.id));
}

/** The Students whose Enrollment in the Class covers the date (default: today), by name. */
export async function classRoster(ctx: Ctx, input: { classId: number; date?: string }): Promise<RosterRow[]> {
  await requireCanSeeClassRoster(ctx, input.classId);
  const date = input.date ?? ctx.clock.today();
  if (!isDate(date)) throw new InvalidInput("errors.dateInvalid");
  return rosterOn(ctx.db, input.classId, date);
}

/**
 * The roster of a Class on a date, by name. No access check: callers (the roster
 * page, the marks grid) check their own guard first.
 */
export function rosterOn(db: Ctx["db"] | Tx, classId: number, date: string): Promise<RosterRow[]> {
  return db
    .select({
      studentId: student.userId,
      name: user.name,
      studentNumber: student.studentNumber,
      startDate: enrollment.startDate,
      endDate: enrollment.endDate,
    })
    .from(enrollment)
    .innerJoin(student, eq(student.userId, enrollment.studentId))
    .innerJoin(user, eq(user.id, student.userId))
    .where(
      and(
        eq(enrollment.classId, classId),
        enrollmentCovers(date),
      ),
    )
    .orderBy(asc(user.name), asc(user.id));
}

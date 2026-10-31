// Year end: Promotion rolls a Class's Students into the new Academic Year, and Closing
// makes the old year read-only once that is done.
//
// Promotion deals with every Student who still has an open Enrollment in the Class, in
// one transaction. Each one's Enrollment ends on the old year's last day (a Leaving
// Student may give an earlier one), and everyone but the Leaving Students starts a new
// Enrollment on the new year's first day. A year can be Closed once none of its
// Enrollments are open, which is what "Promotion is done" means.
import { and, asc, count, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import { academicYear, enrollment, grade, schoolClass, student, user } from "@/db/schema";
import { requireAdmin, requireId } from "../access";
import type { Ctx } from "../context";
import { isCalendarDate } from "../dates";
import type { Tx } from "../enrollment/enrollment";
import { AcademicYearClosed, InvalidInput, NotFound, PromotionNotDone } from "../errors";
import { requireOpenYear } from "../school/closed-year";

export type PromoteClassInput = {
  classId: number;
  /** The next Grade's Class in the new year. Optional only if every Student is an exception. */
  toClassId?: number;
  /** Students staying in the same Grade, each with their Class in the new year. */
  repeating?: { studentId: string; classId: number }[];
  /** Students with no new Enrollment. `lastDay` defaults to the year's last day. */
  leaving?: { studentId: string; lastDay?: string }[];
};

export async function promoteClass(ctx: Ctx, input: PromoteClassInput): Promise<void> {
  requireAdmin(ctx.actor);
  const repeating = input.repeating ?? [];
  const leaving = input.leaving ?? [];

  await ctx.db.transaction(async (tx) => {
    const from = await classInYear(tx, input.classId);
    await requireOpenYear(tx, { academicYearId: from.academicYearId });

    const next = await nextYearAfter(tx, from.yearEnd);
    const to = input.toClassId === undefined ? null : await classInYear(tx, input.toClassId);
    if (to) {
      if (to.academicYearId !== next?.id) throw new InvalidInput("errors.promotionNeedsNextYear");
      if (to.gradeId === from.gradeId) throw new InvalidInput("errors.promotionNeedsNextGrade");
    }
    const repeatClasses = new Map<string, Awaited<ReturnType<typeof classInYear>>>();
    for (const r of repeating) {
      const target = await classInYear(tx, r.classId);
      if (target.academicYearId !== next?.id) throw new InvalidInput("errors.promotionNeedsNextYear");
      if (target.gradeId !== from.gradeId) throw new InvalidInput("errors.promotionRepeatNeedsSameGrade");
      repeatClasses.set(r.studentId, target);
    }
    if (next && (to || repeating.length > 0)) await requireOpenYear(tx, { academicYearId: next.id });

    const open = await tx
      .select({ id: enrollment.id, studentId: enrollment.studentId, startDate: enrollment.startDate })
      .from(enrollment)
      .where(and(eq(enrollment.classId, input.classId), isNull(enrollment.endDate)))
      .for("update");
    if (open.length === 0) throw new InvalidInput("errors.promotionNoStudents");

    const inClass = new Set(open.map((e) => e.studentId));
    const named = [...repeating.map((r) => r.studentId), ...leaving.map((l) => l.studentId)];
    if (named.some((id) => !inClass.has(id))) throw new InvalidInput("errors.promotionStudentNotInClass");
    if (new Set(named).size !== named.length) throw new InvalidInput("errors.promotionStudentTwice");

    const lastDays = new Map(leaving.map((l) => [l.studentId, l.lastDay]));
    const newEnrollments: { studentId: string; classId: number; startDate: string }[] = [];
    for (const e of open) {
      const lastDay = lastDays.get(e.studentId) ?? from.yearEnd;
      if (!isCalendarDate(lastDay) || lastDay < e.startDate || lastDay > from.yearEnd) {
        throw new InvalidInput("errors.promotionLastDayInvalid");
      }
      await tx.update(enrollment).set({ endDate: lastDay }).where(eq(enrollment.id, e.id));

      if (lastDays.has(e.studentId)) continue;
      const target = repeatClasses.get(e.studentId) ?? to;
      if (!target) throw new InvalidInput("errors.promotionTargetRequired");
      newEnrollments.push({ studentId: e.studentId, classId: target.id, startDate: target.yearStart });
    }
    if (newEnrollments.length > 0) await tx.insert(enrollment).values(newEnrollments);
  });
}

export async function closeAcademicYear(ctx: Ctx, input: { academicYearId: number }): Promise<void> {
  requireAdmin(ctx.actor);
  requireId(input.academicYearId);
  await ctx.db.transaction(async (tx) => {
    // Waits for writes holding `requireOpenYear`'s lock, so the check below sees them.
    const [year] = await tx
      .select({ closedAt: academicYear.closedAt })
      .from(academicYear)
      .where(eq(academicYear.id, input.academicYearId))
      .for("update");
    if (!year) throw new NotFound();
    if (year.closedAt) throw new AcademicYearClosed();

    const [waiting] = await tx
      .select({ n: count() })
      .from(enrollment)
      .innerJoin(schoolClass, eq(schoolClass.id, enrollment.classId))
      .where(and(eq(schoolClass.academicYearId, input.academicYearId), isNull(enrollment.endDate)));
    if (waiting.n > 0) throw new PromotionNotDone();

    await tx
      .update(academicYear)
      .set({ closedAt: ctx.clock.now() })
      .where(eq(academicYear.id, input.academicYearId));
  });
}

export type YearEndClass = { id: number; name: string; grade: string; awaitingPromotion: number };

export type YearEndYear = {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  closed: boolean;
  /** Open, and no Student is waiting for Promotion. */
  canClose: boolean;
  classes: YearEndClass[];
};

/** Every Academic Year, newest first, with how many Students each Class still has to promote. */
export async function yearEndOverview(ctx: Ctx): Promise<YearEndYear[]> {
  requireAdmin(ctx.actor);
  const years = await ctx.db.select().from(academicYear).orderBy(desc(academicYear.startDate));
  const classes = await ctx.db
    .select({
      id: schoolClass.id,
      name: schoolClass.name,
      grade: grade.name,
      academicYearId: schoolClass.academicYearId,
    })
    .from(schoolClass)
    .innerJoin(grade, eq(grade.id, schoolClass.gradeId))
    .orderBy(asc(grade.name), asc(schoolClass.name));
  const waiting = await ctx.db
    .select({ classId: enrollment.classId, n: count() })
    .from(enrollment)
    .where(isNull(enrollment.endDate))
    .groupBy(enrollment.classId);
  const waitingBy = new Map(waiting.map((w) => [w.classId, w.n]));

  return years.map((y) => {
    const inYear = classes
      .filter((c) => c.academicYearId === y.id)
      .map(({ id, name, grade: gradeName }) => ({
        id,
        name,
        grade: gradeName,
        awaitingPromotion: waitingBy.get(id) ?? 0,
      }));
    const closed = y.closedAt !== null;
    return {
      id: y.id,
      name: y.name,
      startDate: y.startDate,
      endDate: y.endDate,
      closed,
      canClose: !closed && inYear.every((c) => c.awaitingPromotion === 0),
      classes: inYear,
    };
  });
}

export type PromotionChoice = { id: number; name: string };

export type PromotionForm = {
  class: { id: number; name: string; grade: string; academicYear: string; startDate: string; endDate: string };
  /** The new Academic Year, or null if none has been created yet. */
  nextYear: string | null;
  students: { studentId: string; name: string; studentNumber: string }[];
  /** The new year's Classes in other Grades. */
  targets: PromotionChoice[];
  /** The new year's Classes in the same Grade, for Repeating Students. */
  repeatTargets: PromotionChoice[];
};

/** What the Promotion screen needs for one Class: Students still to promote, and where to. */
export async function promotionForm(ctx: Ctx, input: { classId: number }): Promise<PromotionForm> {
  requireAdmin(ctx.actor);
  const from = await classInYear(ctx.db, input.classId);
  const [named] = await ctx.db
    .select({ name: schoolClass.name, grade: grade.name, academicYear: academicYear.name })
    .from(schoolClass)
    .innerJoin(grade, eq(grade.id, schoolClass.gradeId))
    .innerJoin(academicYear, eq(academicYear.id, schoolClass.academicYearId))
    .where(eq(schoolClass.id, input.classId));

  const students = await ctx.db
    .select({ studentId: student.userId, name: user.name, studentNumber: student.studentNumber })
    .from(enrollment)
    .innerJoin(student, eq(student.userId, enrollment.studentId))
    .innerJoin(user, eq(user.id, student.userId))
    .where(and(eq(enrollment.classId, input.classId), isNull(enrollment.endDate)))
    .orderBy(asc(user.name), asc(user.id));

  const next = await nextYearAfter(ctx.db, from.yearEnd);
  const nextClasses = next
    ? await ctx.db
        .select({ id: schoolClass.id, name: schoolClass.name, gradeId: schoolClass.gradeId, grade: grade.name })
        .from(schoolClass)
        .innerJoin(grade, eq(grade.id, schoolClass.gradeId))
        .where(inArray(schoolClass.academicYearId, [next.id]))
        .orderBy(asc(grade.name), asc(schoolClass.name))
    : [];
  const choice = (c: (typeof nextClasses)[number]) => ({ id: c.id, name: c.name });

  return {
    class: { id: from.id, ...named, startDate: from.yearStart, endDate: from.yearEnd },
    nextYear: next?.name ?? null,
    students,
    targets: nextClasses.filter((c) => c.gradeId !== from.gradeId).map(choice),
    repeatTargets: nextClasses.filter((c) => c.gradeId === from.gradeId).map(choice),
  };
}

async function classInYear(db: Ctx["db"] | Tx, classId: number) {
  requireId(classId);
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

/** The Academic Year starting soonest after a date, or null. */
async function nextYearAfter(db: Ctx["db"] | Tx, date: string) {
  const [next] = await db
    .select({ id: academicYear.id, name: academicYear.name })
    .from(academicYear)
    .where(gt(academicYear.startDate, date))
    .orderBy(asc(academicYear.startDate))
    .limit(1);
  return next ?? null;
}

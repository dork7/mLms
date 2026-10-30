// Lessons: one delivered teaching session of a Class Subject, logged by its Subject
// Teacher with its date, Period (1..N), topic and homework. At most one Lesson per
// Class Subject, date and Period. Who may log and who may read is decided in ../access.ts.
import { asc, desc, eq, type SQL } from "drizzle-orm";
import { academicYear, classSubject, lesson, schoolClass, subject, user } from "@/db/schema";
import { requireCanActOnClassSubject, requireCanSeeClass, requireCanSeeClassSubject } from "../access";
import type { Ctx } from "../context";
import { isCalendarDate } from "../dates";
import { InvalidInput, isUniqueViolation, LessonExists } from "../errors";
import { getPeriodsPerDay } from "../school/periods";

export type LogLessonInput = {
  classSubjectId: number;
  date: string;
  period: number;
  topic: string;
  homework?: string;
};

export async function logLesson(ctx: Ctx, input: LogLessonInput): Promise<{ id: number }> {
  await requireCanActOnClassSubject(ctx, input.classSubjectId);

  const topic = input.topic.trim();
  if (!topic) throw new InvalidInput("errors.lessonTopicRequired");

  const periodsPerDay = await getPeriodsPerDay(ctx);
  if (!Number.isInteger(input.period) || input.period < 1 || input.period > (periodsPerDay ?? 0)) {
    throw new InvalidInput("errors.lessonPeriodOutOfRange");
  }

  if (!isCalendarDate(input.date) || input.date > ctx.clock.today()) {
    throw new InvalidInput("errors.lessonDateInvalid");
  }
  const [year] = await ctx.db
    .select({ startDate: academicYear.startDate, endDate: academicYear.endDate })
    .from(classSubject)
    .innerJoin(schoolClass, eq(schoolClass.id, classSubject.classId))
    .innerJoin(academicYear, eq(academicYear.id, schoolClass.academicYearId))
    .where(eq(classSubject.id, input.classSubjectId));
  if (input.date < year.startDate || input.date > year.endDate) {
    throw new InvalidInput("errors.lessonDateOutsideYear");
  }

  try {
    const [row] = await ctx.db
      .insert(lesson)
      .values({
        classSubjectId: input.classSubjectId,
        date: input.date,
        period: input.period,
        topic,
        homework: (input.homework ?? "").trim(),
        teacherId: ctx.actor.userId,
        loggedAt: ctx.clock.now(),
      })
      .returning({ id: lesson.id });
    return row;
  } catch (err) {
    if (isUniqueViolation(err)) throw new LessonExists();
    throw err;
  }
}

/**
 * What the Lesson form needs: today's date and the Periods to offer (1..N, or 0 until
 * the Admin sets them). Only the Subject Teacher gets it, so the UI shows the form
 * only to the person allowed to log.
 */
export async function lessonFormDefaults(
  ctx: Ctx,
  input: { classSubjectId: number },
): Promise<{ today: string; periodsPerDay: number }> {
  await requireCanActOnClassSubject(ctx, input.classSubjectId);
  return { today: ctx.clock.today(), periodsPerDay: (await getPeriodsPerDay(ctx)) ?? 0 };
}

export type LessonRow = {
  id: number;
  classSubjectId: number;
  date: string;
  period: number;
  subject: string;
  teacher: string;
  topic: string;
  homework: string;
};

/** The class summary: every Lesson of a Class, newest day first, then by Period. */
export async function listClassLessons(ctx: Ctx, input: { classId: number }): Promise<LessonRow[]> {
  await requireCanSeeClass(ctx, input.classId);
  return selectLessons(ctx, eq(classSubject.classId, input.classId));
}

/** One Class Subject's Lessons, for its Subject Teacher (and whoever else may see it). */
export async function listClassSubjectLessons(ctx: Ctx, input: { classSubjectId: number }): Promise<LessonRow[]> {
  await requireCanSeeClassSubject(ctx, input.classSubjectId);
  return selectLessons(ctx, eq(lesson.classSubjectId, input.classSubjectId));
}

function selectLessons(ctx: Ctx, where: SQL): Promise<LessonRow[]> {
  return ctx.db
    .select({
      id: lesson.id,
      classSubjectId: lesson.classSubjectId,
      date: lesson.date,
      period: lesson.period,
      subject: subject.name,
      teacher: user.name,
      topic: lesson.topic,
      homework: lesson.homework,
    })
    .from(lesson)
    .innerJoin(classSubject, eq(classSubject.id, lesson.classSubjectId))
    .innerJoin(subject, eq(subject.id, classSubject.subjectId))
    .innerJoin(user, eq(user.id, lesson.teacherId))
    .where(where)
    .orderBy(desc(lesson.date), asc(lesson.period), asc(subject.name));
}

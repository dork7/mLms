// Assessments: anything graded with Marks for one Class Subject (a quiz, assignment,
// midterm or final), with a date, maximum marks and weight. Its Term is worked out
// from its date and never stored. Who may create, change and see them is decided in
// ../access.ts, always from the Class Subject.
import { and, desc, eq, gte, inArray, isNull, lte, max, or, type SQL } from "drizzle-orm";
import { academicYear, assessment, classSubject, enrollment, mark, schoolClass, subject, term } from "@/db/schema";
import {
  requireCanActOnAssessment,
  requireCanActOnClassSubject,
  requireCanSeeAssessment,
  requireCanSeeClassSubject,
} from "../access";
import type { Ctx } from "../context";
import { isCalendarDate } from "../dates";
import type { Tx } from "../enrollment/enrollment";
import { InvalidInput, NotFound } from "../errors";
import { hasAtMostTwoDecimals, markStats, type MarkStats, type MarkValue, toValue } from "./mark-values";

/**
 * Joins a Mark to the Enrollment that puts its Student on the Assessment's roster. A
 * backdated move can leave a Mark for a Student no longer on it: the grid doesn't list
 * that Mark, so statistics and the maximum check must not count it either.
 */
const markStudentOnRoster = and(
  eq(enrollment.studentId, mark.studentId),
  eq(enrollment.classId, classSubject.classId),
  lte(enrollment.startDate, assessment.date),
  or(isNull(enrollment.endDate), gte(enrollment.endDate, assessment.date)),
);

export const ASSESSMENT_TYPES = ["quiz", "assignment", "midterm", "final"] as const;
export type AssessmentType = (typeof ASSESSMENT_TYPES)[number];

export type CreateAssessmentInput = {
  classSubjectId: number;
  type: AssessmentType;
  date: string;
  maxMarks: number;
  weight: number;
};

export async function createAssessment(ctx: Ctx, input: CreateAssessmentInput): Promise<{ id: number }> {
  await requireCanActOnClassSubject(ctx, input.classSubjectId);
  return insertAssessment(ctx.db, input);
}

/**
 * Validates and stores an Assessment, with no access check: the caller has already
 * decided who may create it (the Subject Teacher above, the Admin for an Exam's) and
 * that the Class Subject exists. Takes a transaction so an Exam can create its own.
 */
export async function insertAssessment(db: Ctx["db"] | Tx, input: CreateAssessmentInput): Promise<{ id: number }> {
  if (!ASSESSMENT_TYPES.includes(input.type)) throw new InvalidInput("errors.assessmentTypeInvalid");
  requireMaxMarks(input.maxMarks);
  requireWeight(input.weight);
  if (!isCalendarDate(input.date)) throw new InvalidInput("errors.assessmentDateInvalid");

  const [year] = await db
    .select({ startDate: academicYear.startDate, endDate: academicYear.endDate })
    .from(classSubject)
    .innerJoin(schoolClass, eq(schoolClass.id, classSubject.classId))
    .innerJoin(academicYear, eq(academicYear.id, schoolClass.academicYearId))
    .where(eq(classSubject.id, input.classSubjectId));
  if (input.date < year.startDate || input.date > year.endDate) {
    throw new InvalidInput("errors.assessmentDateOutsideYear");
  }

  const [row] = await db
    .insert(assessment)
    .values({
      classSubjectId: input.classSubjectId,
      type: input.type,
      date: input.date,
      maxMarks: input.maxMarks,
      weight: input.weight,
    })
    .returning({ id: assessment.id });
  return row;
}

function requireMaxMarks(value: number): void {
  if (!isPositiveHundredths(value)) throw new InvalidInput("errors.assessmentMaxMarksInvalid");
}

function requireWeight(value: number): void {
  if (!isPositiveHundredths(value)) throw new InvalidInput("errors.assessmentWeightInvalid");
}

/** A number above 0 and below 100000 with at most two decimals (the column is numeric(7,2)). */
function isPositiveHundredths(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value < 100000 && hasAtMostTwoDecimals(value);
}

/**
 * Changes an Assessment's maximum marks and weight, even after Marks are entered.
 * Raw Marks are kept (percentages are worked out from the maximum when read), so the
 * maximum can't drop below a score already entered.
 */
export async function updateAssessment(
  ctx: Ctx,
  input: { assessmentId: number; maxMarks: number; weight: number },
): Promise<void> {
  await requireCanActOnAssessment(ctx, input.assessmentId);
  requireMaxMarks(input.maxMarks);
  requireWeight(input.weight);
  await ctx.db.transaction(async (tx) => {
    // Lock the Assessment so a concurrent grid save can't slip in a higher score.
    await tx.select({ id: assessment.id }).from(assessment).where(eq(assessment.id, input.assessmentId)).for("update");
    const [top] = await tx
      .select({ highest: max(mark.score) })
      .from(mark)
      .innerJoin(assessment, eq(assessment.id, mark.assessmentId))
      .innerJoin(classSubject, eq(classSubject.id, assessment.classSubjectId))
      .innerJoin(enrollment, markStudentOnRoster)
      .where(eq(mark.assessmentId, input.assessmentId));
    if (top.highest !== null && Number(top.highest) > input.maxMarks) {
      throw new InvalidInput("errors.assessmentMaxBelowMark");
    }
    await tx
      .update(assessment)
      .set({ maxMarks: input.maxMarks, weight: input.weight })
      .where(eq(assessment.id, input.assessmentId));
  });
}

/**
 * What the new-Assessment form needs (today's date, the types). Only the Subject
 * Teacher gets it, so the UI shows the form only to the person allowed to create.
 */
export async function assessmentFormDefaults(
  ctx: Ctx,
  input: { classSubjectId: number },
): Promise<{ today: string; types: readonly AssessmentType[] }> {
  await requireCanActOnClassSubject(ctx, input.classSubjectId);
  return { today: ctx.clock.today(), types: ASSESSMENT_TYPES };
}

export type AssessmentRow = {
  id: number;
  classSubjectId: number;
  classId: number;
  class: string;
  subject: string;
  type: AssessmentType;
  date: string;
  /** The Term the date falls in, or null if the year's Terms were later moved away from it. */
  term: string | null;
  maxMarks: number;
  weight: number;
};

export type AssessmentWithStats = AssessmentRow & { stats: MarkStats };

/** A Class Subject's Assessments, newest first, each with its statistics. */
export async function listAssessments(
  ctx: Ctx,
  input: { classSubjectId: number },
): Promise<AssessmentWithStats[]> {
  await requireCanSeeClassSubject(ctx, input.classSubjectId);
  const rows = await selectAssessments(ctx, eq(assessment.classSubjectId, input.classSubjectId));
  if (rows.length === 0) return [];
  const marks = await ctx.db
    .select({ assessmentId: mark.assessmentId, score: mark.score, status: mark.status })
    .from(mark)
    .innerJoin(assessment, eq(assessment.id, mark.assessmentId))
    .innerJoin(classSubject, eq(classSubject.id, assessment.classSubjectId))
    .innerJoin(enrollment, markStudentOnRoster)
    .where(
      inArray(
        mark.assessmentId,
        rows.map((r) => r.id),
      ),
    );
  const values = new Map<number, MarkValue[]>();
  for (const m of marks) values.set(m.assessmentId, [...(values.get(m.assessmentId) ?? []), toValue(m)]);
  return rows.map((r) => ({ ...r, stats: markStats(values.get(r.id) ?? []) }));
}

export async function getAssessment(ctx: Ctx, input: { assessmentId: number }): Promise<AssessmentRow> {
  await requireCanSeeAssessment(ctx, input.assessmentId);
  const [row] = await selectAssessments(ctx, eq(assessment.id, input.assessmentId));
  if (!row) throw new NotFound();
  return row;
}

export function selectAssessments(ctx: Ctx, where: SQL): Promise<AssessmentRow[]> {
  return ctx.db
    .select({
      id: assessment.id,
      classSubjectId: assessment.classSubjectId,
      classId: schoolClass.id,
      class: schoolClass.name,
      subject: subject.name,
      type: assessment.type,
      date: assessment.date,
      term: term.name,
      maxMarks: assessment.maxMarks,
      weight: assessment.weight,
    })
    .from(assessment)
    .innerJoin(classSubject, eq(classSubject.id, assessment.classSubjectId))
    .innerJoin(schoolClass, eq(schoolClass.id, classSubject.classId))
    .innerJoin(subject, eq(subject.id, classSubject.subjectId))
    .leftJoin(
      term,
      and(
        eq(term.academicYearId, schoolClass.academicYearId),
        lte(term.startDate, assessment.date),
        gte(term.endDate, assessment.date),
      ),
    )
    .where(where)
    .orderBy(desc(assessment.date), desc(assessment.id));
}

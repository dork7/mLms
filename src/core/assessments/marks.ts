// Marks: a Student's raw score (0..maximum) on one Assessment, or Absent (counts as
// zero) or Exempt (left out). The grid for an Assessment is exactly its Class's roster
// on the Assessment's date, whatever Class those Students are in today. Saving the
// grid is one batch upsert in one transaction.
import { and, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { assessment, classSubject, enrollment, mark, schoolClass, subject, term } from "@/db/schema";
import { canSeeClassSubjectMarks, requireCanActOnAssessment, requireCanSeeStudentMarks } from "../access";
import type { Ctx } from "../context";
import { rosterOn } from "../enrollment/enrollment";
import { AccessDenied, InvalidInput, NotFound } from "../errors";
import { type AssessmentRow, type AssessmentType, getAssessment } from "./assessments";
import { markStats, type MarkStats, type MarkValue, percentOf, requireValidMark, toValue } from "./mark-values";

export type { MarkValue } from "./mark-values";

export type GridRow = {
  studentId: string;
  name: string;
  studentNumber: string;
  mark: MarkValue;
  /** The score as a percentage of the current maximum (Absent = 0); null if Exempt or not entered. */
  percent: number | null;
};

export type MarksGrid = {
  assessment: AssessmentRow;
  rows: GridRow[];
  stats: MarkStats;
  /** Whether the actor may enter Marks (only the Subject Teacher), as the access policy says. */
  canEnterMarks: boolean;
};

export async function marksGrid(ctx: Ctx, input: { assessmentId: number }): Promise<MarksGrid> {
  const found = await getAssessment(ctx, input);
  const roster = await rosterOn(ctx.db, found.classId, found.date);
  const marks = await ctx.db
    .select({ studentId: mark.studentId, score: mark.score, status: mark.status })
    .from(mark)
    .where(eq(mark.assessmentId, found.id));
  const byStudent = new Map(marks.map((m) => [m.studentId, toValue(m)]));
  const rows = roster.map((r) => {
    const value = byStudent.get(r.studentId) ?? null;
    return {
      studentId: r.studentId,
      name: r.name,
      studentNumber: r.studentNumber,
      mark: value,
      percent: percentOf(value, found.maxMarks),
    };
  });
  return {
    assessment: found,
    rows,
    stats: markStats(rows.map((r) => r.mark)),
    canEnterMarks: await canActOn(ctx, found.id),
  };
}

export type HistoryRow = {
  assessmentId: number;
  classSubjectId: number;
  class: string;
  subject: string;
  type: AssessmentType;
  date: string;
  term: string | null;
  maxMarks: number;
  weight: number;
  mark: MarkValue;
  percent: number | null;
};

/**
 * One Student's Assessment history, newest first: every Assessment of a Class Subject
 * in a Class the Student was enrolled in on the Assessment's date, with their Mark
 * (null if not entered). The Student and the Admin see all of it; a Teacher sees only
 * the Class Subjects they can see (see `canSeeClassSubjectMarks`).
 */
export async function studentAssessmentHistory(ctx: Ctx, input: { studentId: string }): Promise<HistoryRow[]> {
  await requireCanSeeStudentMarks(ctx, input.studentId);
  const visible = ctx.actor.role === "student" ? sql<boolean>`true` : canSeeClassSubjectMarks(ctx.actor);
  const rows = await ctx.db
    .select({
      assessmentId: assessment.id,
      classSubjectId: assessment.classSubjectId,
      class: schoolClass.name,
      subject: subject.name,
      type: assessment.type,
      date: assessment.date,
      term: term.name,
      maxMarks: assessment.maxMarks,
      weight: assessment.weight,
      score: mark.score,
      status: mark.status,
    })
    .from(assessment)
    .innerJoin(classSubject, eq(classSubject.id, assessment.classSubjectId))
    .innerJoin(schoolClass, eq(schoolClass.id, classSubject.classId))
    .innerJoin(subject, eq(subject.id, classSubject.subjectId))
    .innerJoin(
      enrollment,
      and(
        eq(enrollment.classId, schoolClass.id),
        eq(enrollment.studentId, input.studentId),
        lte(enrollment.startDate, assessment.date),
        or(isNull(enrollment.endDate), gte(enrollment.endDate, assessment.date)),
      ),
    )
    .leftJoin(
      term,
      and(
        eq(term.academicYearId, schoolClass.academicYearId),
        lte(term.startDate, assessment.date),
        gte(term.endDate, assessment.date),
      ),
    )
    .leftJoin(mark, and(eq(mark.assessmentId, assessment.id), eq(mark.studentId, input.studentId)))
    .where(visible)
    .orderBy(desc(assessment.date), desc(assessment.id));
  return rows.map(({ score, status, ...r }) => {
    const value = toValue({ score, status });
    return { ...r, mark: value, percent: percentOf(value, r.maxMarks) };
  });
}

async function canActOn(ctx: Ctx, assessmentId: number): Promise<boolean> {
  try {
    await requireCanActOnAssessment(ctx, assessmentId);
    return true;
  } catch (err) {
    if (err instanceof AccessDenied) return false;
    throw err;
  }
}

export type SaveMarksInput = {
  assessmentId: number;
  marks: { studentId: string; mark: MarkValue }[];
};

/**
 * Saves a grid of Marks in one transaction: every Student must be on the roster on
 * the Assessment's date and every score in range, or nothing is saved. A null Mark
 * clears it.
 */
export async function saveMarks(ctx: Ctx, input: SaveMarksInput): Promise<{ saved: number }> {
  await requireCanActOnAssessment(ctx, input.assessmentId);

  // The last entry wins if a Student appears twice.
  const entries = [...new Map(input.marks.map((m) => [m.studentId, m.mark])).entries()];
  return ctx.db.transaction(async (tx) => {
    const [found] = await tx
      .select({ date: assessment.date, maxMarks: assessment.maxMarks, classId: classSubject.classId })
      .from(assessment)
      .innerJoin(classSubject, eq(classSubject.id, assessment.classSubjectId))
      .where(eq(assessment.id, input.assessmentId))
      .for("update", { of: assessment });
    if (!found) throw new NotFound();

    const onRoster = new Set((await rosterOn(tx, found.classId, found.date)).map((r) => r.studentId));
    for (const [studentId, value] of entries) {
      if (!onRoster.has(studentId)) throw new InvalidInput("errors.markStudentNotOnRoster");
      requireValidMark(value, found.maxMarks);
    }

    const cleared = entries.filter(([, value]) => value === null).map(([studentId]) => studentId);
    const written = entries
      .filter(([, value]) => value !== null)
      .map(([studentId, value]) => ({
        assessmentId: input.assessmentId,
        studentId,
        score: typeof value === "number" ? value : null,
        status: typeof value === "string" ? value : null,
      }));

    if (cleared.length > 0) {
      await tx.delete(mark).where(and(eq(mark.assessmentId, input.assessmentId), inArray(mark.studentId, cleared)));
    }
    if (written.length > 0) {
      await tx
        .insert(mark)
        .values(written)
        .onConflictDoUpdate({
          target: [mark.assessmentId, mark.studentId],
          set: { score: sql`excluded.score`, status: sql`excluded.status` },
        });
    }
    return { saved: entries.length };
  });
}


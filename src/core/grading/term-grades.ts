// Term Grades: a Student's weighted result in one Subject for one Term, worked out when
// read and never stored. It takes every Assessment in the Term for any Class Subject of
// the Subject in any Class the Student was enrolled in on the Assessment's date, so a
// mid-Term move loses nothing. The label and pass or fail come from the Grading Scale
// of the Issuing Class's Grade (the Student's Class on the Term's last day).
import { and, asc, eq, gte, inArray, isNull, lte, or, type SQL } from "drizzle-orm";
import type { Db } from "@/db/client";
import {
  academicYear,
  assessment,
  classSubject,
  enrollment,
  grade,
  mark,
  schoolClass,
  student,
  subject,
  term,
  user,
} from "@/db/schema";
import {
  canSeeClassSubjectMarks,
  canSeeTermGrade,
  requireCanSeeClassSubject,
  requireCanSeeStudentMarks,
} from "../access";
import { type MarkValue, toValue } from "../assessments/mark-values";
import type { Ctx } from "../context";
import { NotFound } from "../errors";
import { scalesFor } from "./grading-scales";
import { type GradingScale, readOnScale, type ScaleReading, termGradeFigures, type TermGradeFigures } from "./term-grade-rules";

export type TermGrade = TermGradeFigures & ScaleReading & { subjectId: number; subject: string };

export type TermRef = { id: number; name: string; startDate: string; endDate: string; academicYear: string };

export type IssuingClass = { id: number; name: string; gradeId: number; grade: string; classTeacherId: string };

export type StudentTerm = { term: TermRef; issuingClass: IssuingClass | null; grades: TermGrade[] };

/**
 * One Student's Term Grades, newest Term first and by Subject within it. The Admin and
 * the Student see all of them; a Teacher only those `canSeeTermGrade` allows. A Term
 * the actor sees nothing of is left out.
 */
export async function studentTermGrades(ctx: Ctx, input: { studentId: string }): Promise<StudentTerm[]> {
  await requireCanSeeStudentMarks(ctx, input.studentId);
  const rows = await countedAssessments(ctx, eq(enrollment.studentId, input.studentId));

  const terms = new Map<number, TermRef>(rows.map((r) => [r.term.id, r.term]));
  const issuing = new Map<number, IssuingClass | null>();
  for (const t of terms.values()) {
    issuing.set(t.id, (await issuingClasses(ctx.db, [input.studentId], t.endDate)).get(input.studentId) ?? null);
  }
  const scales = await scalesFor(ctx.db, gradeIdsOf(issuing.values()));

  return [...terms.values()]
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
    .map((t) => {
      const issuingClass = issuing.get(t.id) ?? null;
      const scale = issuingClass ? (scales.get(issuingClass.gradeId) ?? null) : null;
      const inTerm = rows.filter((r) => r.term.id === t.id);
      const grades = bySubject(inTerm)
        .filter((entries) =>
          canSeeTermGrade(ctx.actor, {
            studentId: input.studentId,
            seesACountedClassSubject: entries.some((e) => e.seen),
            issuingClassTeacherId: issuingClass?.classTeacherId ?? null,
          }),
        )
        .map((entries) => toTermGrade(entries, scale));
      return { term: t, issuingClass, grades };
    })
    .filter((t) => t.grades.length > 0);
}

export type ClassSubjectTermRow = {
  studentId: string;
  name: string;
  studentNumber: string;
  /** The Student's Class on the Term's last day, which may be another Class by now. */
  issuingClass: string | null;
  grade: TermGrade;
};

export type ClassSubjectTermGrades = {
  subject: string;
  class: string;
  /** Every Term of the Class's Academic Year, in date order. */
  terms: TermRef[];
  term: TermRef;
  rows: ClassSubjectTermRow[];
};

/**
 * One Term's Term Grades in a Class Subject's Subject: every Student enrolled in the
 * Class at any time during the Term, each with their whole Term Grade across Classes.
 * Opens on today's Term, or the year's first if today is outside the year.
 */
export async function classSubjectTermGrades(
  ctx: Ctx,
  input: { classSubjectId: number; termId?: number },
): Promise<ClassSubjectTermGrades> {
  await requireCanSeeClassSubject(ctx, input.classSubjectId);
  const [found] = await ctx.db
    .select({
      subjectId: classSubject.subjectId,
      subject: subject.name,
      classId: classSubject.classId,
      class: schoolClass.name,
      academicYearId: schoolClass.academicYearId,
    })
    .from(classSubject)
    .innerJoin(schoolClass, eq(schoolClass.id, classSubject.classId))
    .innerJoin(subject, eq(subject.id, classSubject.subjectId))
    .where(eq(classSubject.id, input.classSubjectId));
  if (!found) throw new NotFound();

  const terms = await ctx.db
    .select(termColumns)
    .from(term)
    .innerJoin(academicYear, eq(academicYear.id, term.academicYearId))
    .where(eq(term.academicYearId, found.academicYearId))
    .orderBy(asc(term.startDate));
  const today = ctx.clock.today();
  const chosen =
    input.termId === undefined
      ? (terms.find((t) => t.startDate <= today && today <= t.endDate) ?? terms[0])
      : terms.find((t) => t.id === input.termId);
  if (!chosen) throw new NotFound();

  const students = await ctx.db
    .selectDistinct({ studentId: student.userId, name: user.name, studentNumber: student.studentNumber })
    .from(enrollment)
    .innerJoin(student, eq(student.userId, enrollment.studentId))
    .innerJoin(user, eq(user.id, student.userId))
    .where(
      and(
        eq(enrollment.classId, found.classId),
        lte(enrollment.startDate, chosen.endDate),
        or(isNull(enrollment.endDate), gte(enrollment.endDate, chosen.startDate)),
      ),
    )
    .orderBy(asc(user.name));
  const ids = students.map((s) => s.studentId);

  const issuing = await issuingClasses(ctx.db, ids, chosen.endDate);
  const scales = await scalesFor(ctx.db, gradeIdsOf(issuing.values()));
  const rows =
    ids.length === 0
      ? []
      : await countedAssessments(
          ctx,
          and(inArray(enrollment.studentId, ids), eq(term.id, chosen.id), eq(classSubject.subjectId, found.subjectId)),
        );

  return {
    subject: found.subject,
    class: found.class,
    terms,
    term: chosen,
    rows: students.map((s) => {
      const issuingClass = issuing.get(s.studentId);
      const entries = rows.filter((r) => r.studentId === s.studentId);
      const scale = issuingClass ? (scales.get(issuingClass.gradeId) ?? null) : null;
      return {
        ...s,
        issuingClass: issuingClass?.name ?? null,
        grade: entries.length
          ? toTermGrade(entries, scale)
          : { ...termGradeFigures([]), ...readOnScale(null, null), subjectId: found.subjectId, subject: found.subject },
      };
    }),
  };
}

/**
 * Each Student's Issuing Class for a Term ending on `lastDay`: the Class they're enrolled
 * in on that day. A Student enrolled nowhere that day is absent from the map. No access
 * check: for callers that already checked.
 */
export async function issuingClasses(db: Db, studentIds: string[], lastDay: string): Promise<Map<string, IssuingClass>> {
  if (studentIds.length === 0) return new Map();
  const rows = await db
    .select({
      studentId: enrollment.studentId,
      id: schoolClass.id,
      name: schoolClass.name,
      gradeId: schoolClass.gradeId,
      grade: grade.name,
      classTeacherId: schoolClass.classTeacherId,
    })
    .from(enrollment)
    .innerJoin(schoolClass, eq(schoolClass.id, enrollment.classId))
    .innerJoin(grade, eq(grade.id, schoolClass.gradeId))
    .where(
      and(
        inArray(enrollment.studentId, studentIds),
        lte(enrollment.startDate, lastDay),
        or(isNull(enrollment.endDate), gte(enrollment.endDate, lastDay)),
      ),
    )
    .orderBy(asc(enrollment.startDate));
  return new Map(rows.map(({ studentId, ...issuing }) => [studentId, issuing]));
}

const termColumns = {
  id: term.id,
  name: term.name,
  startDate: term.startDate,
  endDate: term.endDate,
  academicYear: academicYear.name,
};

type CountedAssessment = {
  studentId: string;
  term: TermRef;
  subjectId: number;
  subject: string;
  weight: number;
  maxMarks: number;
  mark: MarkValue;
  /** Whether the actor can see this Assessment's Class Subject's Marks. */
  seen: boolean;
};

/**
 * Every Assessment that belongs in a Term Grade, per Student: its Class Subject's Class
 * had the Student enrolled on its date, and the date is in a Term of the Class's year.
 * A Mark left behind by a backdated move is therefore never read.
 */
async function countedAssessments(ctx: Ctx, where: SQL | undefined): Promise<CountedAssessment[]> {
  // Distinct: two Enrollments covering one date must not count an Assessment twice.
  const rows = await ctx.db
    .selectDistinct({
      assessmentId: assessment.id,
      studentId: enrollment.studentId,
      termId: term.id,
      termName: term.name,
      termStart: term.startDate,
      termEnd: term.endDate,
      academicYear: academicYear.name,
      subjectId: subject.id,
      subject: subject.name,
      weight: assessment.weight,
      maxMarks: assessment.maxMarks,
      score: mark.score,
      status: mark.status,
      seen: canSeeClassSubjectMarks(ctx.actor),
    })
    .from(assessment)
    .innerJoin(classSubject, eq(classSubject.id, assessment.classSubjectId))
    .innerJoin(schoolClass, eq(schoolClass.id, classSubject.classId))
    .innerJoin(subject, eq(subject.id, classSubject.subjectId))
    .innerJoin(
      term,
      and(
        eq(term.academicYearId, schoolClass.academicYearId),
        lte(term.startDate, assessment.date),
        gte(term.endDate, assessment.date),
      ),
    )
    .innerJoin(academicYear, eq(academicYear.id, term.academicYearId))
    .innerJoin(
      enrollment,
      and(
        eq(enrollment.classId, schoolClass.id),
        lte(enrollment.startDate, assessment.date),
        or(isNull(enrollment.endDate), gte(enrollment.endDate, assessment.date)),
      ),
    )
    .leftJoin(mark, and(eq(mark.assessmentId, assessment.id), eq(mark.studentId, enrollment.studentId)))
    .where(where);
  return rows.map((r) => ({
    studentId: r.studentId,
    term: { id: r.termId, name: r.termName, startDate: r.termStart, endDate: r.termEnd, academicYear: r.academicYear },
    subjectId: r.subjectId,
    subject: r.subject,
    weight: r.weight,
    maxMarks: r.maxMarks,
    mark: toValue(r),
    seen: r.seen,
  }));
}

/** Groups one Student's one Term by Subject, in Subject name order. */
function bySubject(rows: CountedAssessment[]): CountedAssessment[][] {
  const groups = new Map<number, CountedAssessment[]>();
  for (const r of rows) groups.set(r.subjectId, [...(groups.get(r.subjectId) ?? []), r]);
  return [...groups.values()].sort((a, b) => a[0].subject.localeCompare(b[0].subject));
}

function toTermGrade(entries: CountedAssessment[], scale: GradingScale | null): TermGrade {
  const figures = termGradeFigures(entries);
  return {
    subjectId: entries[0].subjectId,
    subject: entries[0].subject,
    ...figures,
    ...readOnScale(figures.percent, scale),
  };
}

function gradeIdsOf(classes: Iterable<IssuingClass | null>): number[] {
  const ids = new Set<number>();
  for (const c of classes) if (c) ids.add(c.gradeId);
  return [...ids];
}

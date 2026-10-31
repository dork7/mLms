// Report Cards: a Student's Term Grades for one Term with their remarks, drawn up for
// the Issuing Class (their Class on the Term's last day). Nothing here is stored except
// the remarks; the figures are worked out when read.
import { and, eq, inArray, or } from "drizzle-orm";
import { classSubject, overallRemark, schoolClass, subject, subjectRemark, user } from "@/db/schema";
import { requireAdmin, requireId } from "../access";
import type { Ctx } from "../context";
import { rosterOn } from "../enrollment/enrollment";
import { NotFound } from "../errors";
import {
  chooseTerm,
  emptyTermGrade,
  type IssuingClass,
  issuingClasses,
  type TermGrade,
  termGradesIn,
  type TermRef,
  yearTerms,
} from "../grading/term-grades";
import { rankIsEnabled } from "./rank-setting";
import { flagsOf, overallPercentOf, type ReportCardFlag, ranksOf } from "./report-card-rules";

export type ReportCardGrade = TermGrade & {
  /** The Class Subject whose Subject Teacher writes this remark. */
  classSubjectId: number;
  teacherId: string;
  teacher: string;
  remark: string | null;
};

export type DraftReportCard = {
  issuingClass: IssuingClass;
  /** The Issuing Class's Class Teacher's name. */
  classTeacher: string;
  grades: ReportCardGrade[];
  /** The plain average of the Term Grade percentages; null if none has one. */
  overallPercent: number | null;
  overallRemark: string | null;
};

/**
 * The Report Cards of these Students for a Term, in full. A Student with no Class on the
 * Term's last day has no Issuing Class, so no Report Card, and is absent from the map.
 *
 * A row's remark falls to the Subject Teacher in the Issuing Class. A Subject the Issuing
 * Class doesn't have falls to the Class Subject of its latest Assessment, so that every
 * remark asked for has someone who can write it. No access check: for callers that
 * already checked.
 */
export async function draftReportCards(
  ctx: Ctx,
  studentIds: string[],
  term: TermRef,
): Promise<Map<string, DraftReportCard>> {
  const issuing = await issuingClasses(ctx.db, studentIds, term.endDate);
  const onCards = studentIds.filter((id) => issuing.has(id));
  if (onCards.length === 0) return new Map();
  const termGrades = await termGradesIn(ctx, onCards, term, issuing);

  const issuingClassIds = [...new Set([...issuing.values()].map((c) => c.id))];
  const latestIds = [...termGrades.values()].flat().map((g) => g.latestClassSubjectId);
  const classSubjects = await ctx.db
    .select({
      id: classSubject.id,
      classId: classSubject.classId,
      subjectId: classSubject.subjectId,
      subject: subject.name,
      teacherId: classSubject.teacherId,
      teacher: user.name,
    })
    .from(classSubject)
    .innerJoin(subject, eq(subject.id, classSubject.subjectId))
    .innerJoin(user, eq(user.id, classSubject.teacherId))
    .where(or(inArray(classSubject.classId, issuingClassIds), inArray(classSubject.id, latestIds)));
  const byId = new Map(classSubjects.map((cs) => [cs.id, cs]));

  const remarks = await ctx.db
    .select()
    .from(subjectRemark)
    .where(and(inArray(subjectRemark.studentId, onCards), eq(subjectRemark.termLastDay, term.endDate)));
  const remarkOf = new Map(remarks.map((r) => [`${r.classSubjectId}:${r.studentId}`, r.remark]));
  const overalls = await ctx.db
    .select()
    .from(overallRemark)
    .where(and(inArray(overallRemark.studentId, onCards), eq(overallRemark.termLastDay, term.endDate)));
  const overallOf = new Map(overalls.map((r) => [`${r.classId}:${r.studentId}`, r.remark]));

  const classTeachers = await ctx.db
    .select({ classId: schoolClass.id, name: user.name })
    .from(schoolClass)
    .innerJoin(user, eq(user.id, schoolClass.classTeacherId))
    .where(inArray(schoolClass.id, issuingClassIds));
  const classTeacherOf = new Map(classTeachers.map((c) => [c.classId, c.name]));

  return new Map(
    onCards.map((studentId) => {
      const issuingClass = issuing.get(studentId)!;
      const taught = classSubjects.filter((cs) => cs.classId === issuingClass.id);
      const inTerm = termGrades.get(studentId) ?? [];
      const rows = [
        ...inTerm.map(({ grade, latestClassSubjectId }) => ({
          grade,
          owner: taught.find((cs) => cs.subjectId === grade.subjectId) ?? byId.get(latestClassSubjectId)!,
        })),
        // A Subject the Issuing Class has but with no Assessment yet still belongs on the card.
        ...taught
          .filter((cs) => !inTerm.some((g) => g.grade.subjectId === cs.subjectId))
          .map((cs) => ({ grade: emptyTermGrade(cs.subjectId, cs.subject), owner: cs })),
      ].sort((a, b) => a.grade.subject.localeCompare(b.grade.subject));
      const grades = rows.map(({ grade, owner }) => ({
        ...grade,
        classSubjectId: owner.id,
        teacherId: owner.teacherId,
        teacher: owner.teacher,
        remark: remarkOf.get(`${owner.id}:${studentId}`) ?? null,
      }));
      return [
        studentId,
        {
          issuingClass,
          classTeacher: classTeacherOf.get(issuingClass.id)!,
          grades,
          overallPercent: overallPercentOf(grades),
          overallRemark: overallOf.get(`${issuingClass.id}:${studentId}`) ?? null,
        },
      ];
    }),
  );
}

export type NamedReportCard = DraftReportCard & { studentId: string; name: string; studentNumber: string };

/**
 * The Report Cards a Class issues for a Term: every Student whose Issuing Class it is, by
 * name. No access check: for callers that already checked.
 */
export async function reportCardsIssuedBy(ctx: Ctx, classId: number, term: TermRef): Promise<NamedReportCard[]> {
  const roster = await rosterOn(ctx.db, classId, term.endDate);
  const drafts = await draftReportCards(
    ctx,
    roster.map((r) => r.studentId),
    term,
  );
  return roster.flatMap(({ studentId, name, studentNumber }) => {
    const draft = drafts.get(studentId);
    return draft?.issuingClass.id === classId ? [{ ...draft, studentId, name, studentNumber }] : [];
  });
}

export type ReportCard = NamedReportCard & {
  /** Null while rank is switched off, or with no overall percentage to rank. */
  rank: number | null;
  flags: ReportCardFlag[];
};

export type ClassReportCards = {
  class: string;
  /** Every Term of the Class's Academic Year, in date order. */
  terms: TermRef[];
  term: TermRef;
  rankEnabled: boolean;
  cards: ReportCard[];
};

/**
 * The Admin's preview of a Class's Report Cards for a Term, with what's still missing
 * from each. Opens on today's Term, or the year's first if today is outside the year.
 */
export async function classReportCards(ctx: Ctx, input: { classId: number; termId?: number }): Promise<ClassReportCards> {
  requireAdmin(ctx.actor);
  const { class: className, terms, term } = await classAndTerm(ctx, input);
  const issued = await reportCardsIssuedBy(ctx, input.classId, term);
  const rankEnabled = await rankIsEnabled(ctx.db);
  const ranks = rankEnabled ? ranksOf(issued) : new Map<string, number>();
  const cards = issued.map((card) => ({
    ...card,
    rank: ranks.get(card.studentId) ?? null,
    flags: flagsOf(card),
  }));
  return { class: className, terms, term, rankEnabled, cards };
}

/** A Class with its year's Terms and the chosen one. No access check. */
export async function classAndTerm(ctx: Ctx, input: { classId: number; termId?: number }) {
  requireId(input.classId);
  const [found] = await ctx.db
    .select({ name: schoolClass.name, academicYearId: schoolClass.academicYearId })
    .from(schoolClass)
    .where(eq(schoolClass.id, input.classId));
  if (!found) throw new NotFound();
  const terms = await yearTerms(ctx.db, found.academicYearId);
  return { class: found.name, terms, term: chooseTerm(terms, ctx.clock.today(), input.termId) };
}

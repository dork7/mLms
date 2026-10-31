// Report Card remarks: one per Student from the Subject Teacher for each Term Grade, and
// one overall from the Issuing Class's Class Teacher. An empty remark clears it, so a
// blank never passes for one in the Admin's preview.
import { and, eq } from "drizzle-orm";
import { classSubject, overallRemark, schoolClass, subject, subjectRemark } from "@/db/schema";
import { requireCanActOnClass, requireCanActOnClassSubject, requireRemarkWriter } from "../access";
import type { Ctx } from "../context";
import { InvalidInput, NotFound } from "../errors";
import {
  chooseTerm,
  issuingClasses,
  studentsInClassDuring,
  type TermGrade,
  type TermRef,
  yearTerms,
} from "../grading/term-grades";
import { isYearClosed, requireOpenYear } from "../school/closed-year";
import { requireCardNotPublished, studentsPublishedFor } from "./publications";
import { classAndTerm, draftReportCards, type NamedReportCard, reportCardsIssuedBy } from "./report-cards";

const MAX_REMARK_LENGTH = 1000;

/** What is stored for a remark as typed: trimmed, with null meaning there's none. */
function remarkText(remark: string): string | null {
  const text = remark.trim();
  if (text.length > MAX_REMARK_LENGTH) throw new InvalidInput("errors.remarkTooLong");
  return text === "" ? null : text;
}

export async function saveSubjectRemark(
  ctx: Ctx,
  input: { classSubjectId: number; termId: number; studentId: string; remark: string },
): Promise<void> {
  await requireCanActOnClassSubject(ctx, input.classSubjectId);
  const text = remarkText(input.remark);
  const { term } = await classSubjectAndTerm(ctx, input);

  const card = (await draftReportCards(ctx, [input.studentId], term)).get(input.studentId);
  const row = card?.grades.find((g) => g.classSubjectId === input.classSubjectId);
  requireRemarkWriter(ctx.actor, row?.teacherId);

  const key = { classSubjectId: input.classSubjectId, studentId: input.studentId, termLastDay: term.endDate };
  await ctx.db.transaction(async (tx) => {
    await requireOpenYear(tx, { classSubjectId: input.classSubjectId });
    await requireCardNotPublished(tx, input.studentId, term.endDate);
    if (text === null) {
      await tx
        .delete(subjectRemark)
        .where(
          and(
            eq(subjectRemark.classSubjectId, key.classSubjectId),
            eq(subjectRemark.studentId, key.studentId),
            eq(subjectRemark.termLastDay, key.termLastDay),
          ),
        );
      return;
    }
    await tx
      .insert(subjectRemark)
      .values({ ...key, remark: text })
      .onConflictDoUpdate({
        target: [subjectRemark.classSubjectId, subjectRemark.studentId, subjectRemark.termLastDay],
        set: { remark: text },
      });
  });
}

export async function saveOverallRemark(
  ctx: Ctx,
  input: { classId: number; termId: number; studentId: string; remark: string },
): Promise<void> {
  await requireCanActOnClass(ctx, input.classId);
  const text = remarkText(input.remark);
  const { term } = await classAndTerm(ctx, input);

  const issuing = (await issuingClasses(ctx.db, [input.studentId], term.endDate)).get(input.studentId);
  requireRemarkWriter(ctx.actor, issuing?.id === input.classId ? issuing.classTeacherId : undefined);

  const key = { classId: input.classId, studentId: input.studentId, termLastDay: term.endDate };
  await ctx.db.transaction(async (tx) => {
    await requireOpenYear(tx, { classId: input.classId });
    await requireCardNotPublished(tx, input.studentId, term.endDate);
    if (text === null) {
      await tx
        .delete(overallRemark)
        .where(
          and(
            eq(overallRemark.classId, key.classId),
            eq(overallRemark.studentId, key.studentId),
            eq(overallRemark.termLastDay, key.termLastDay),
          ),
        );
      return;
    }
    await tx
      .insert(overallRemark)
      .values({ ...key, remark: text })
      .onConflictDoUpdate({
        target: [overallRemark.classId, overallRemark.studentId, overallRemark.termLastDay],
        set: { remark: text },
      });
  });
}

export type SubjectRemarkRow = {
  studentId: string;
  name: string;
  studentNumber: string;
  grade: TermGrade;
  remark: string | null;
  /** The Student's Report Card is Published for this Term, so the remark can't change. */
  published: boolean;
};

export type SubjectRemarkSheet = {
  subject: string;
  class: string;
  /** Every Term of the Class's Academic Year, in date order. */
  terms: TermRef[];
  term: TermRef;
  /** A Closed year's remarks can be read but not changed. */
  yearClosed: boolean;
  rows: SubjectRemarkRow[];
};

/**
 * What a Subject Teacher writes remarks from: the Students whose remark falls to this
 * Class Subject for the Term, each with their whole Term Grade across Classes. A Student
 * who moved away isn't here, since the remark falls to their Issuing Class's Subject Teacher.
 */
export async function subjectRemarkSheet(
  ctx: Ctx,
  input: { classSubjectId: number; termId?: number },
): Promise<SubjectRemarkSheet> {
  await requireCanActOnClassSubject(ctx, input.classSubjectId);
  const { classId, subject, class: className, terms, term } = await classSubjectAndTerm(ctx, input);
  const students = await studentsInClassDuring(ctx.db, classId, term);
  const cards = await draftReportCards(
    ctx,
    students.map((s) => s.studentId),
    term,
  );
  const published = await studentsPublishedFor(
    ctx.db,
    term.endDate,
    students.map((s) => s.studentId),
  );
  const rows = students.flatMap((s) => {
    const row = cards.get(s.studentId)?.grades.find((g) => g.classSubjectId === input.classSubjectId);
    return row ? [{ ...s, grade: row, remark: row.remark, published: published.has(s.studentId) }] : [];
  });
  const yearClosed = await isYearClosed(ctx.db, { classId });
  return { subject, class: className, terms, term, yearClosed, rows };
}

export type OverallRemarkSheet = {
  class: string;
  /** Every Term of the Class's Academic Year, in date order. */
  terms: TermRef[];
  term: TermRef;
  /** A Closed year's remarks can be read but not changed. */
  yearClosed: boolean;
  rows: (NamedReportCard & { published: boolean })[];
};

/**
 * What a Class Teacher writes overall remarks from: the Students whose Issuing Class this
 * is, each with every Term Grade on their Report Card and the overall percentage. Rank is
 * left out: it's for the Admin's preview here.
 */
export async function overallRemarkSheet(ctx: Ctx, input: { classId: number; termId?: number }): Promise<OverallRemarkSheet> {
  await requireCanActOnClass(ctx, input.classId);
  const { class: className, terms, term } = await classAndTerm(ctx, input);
  const cards = await reportCardsIssuedBy(ctx, input.classId, term);
  const published = await studentsPublishedFor(
    ctx.db,
    term.endDate,
    cards.map((c) => c.studentId),
  );
  return {
    class: className,
    terms,
    term,
    yearClosed: await isYearClosed(ctx.db, { classId: input.classId }),
    rows: cards.map((card) => ({ ...card, published: published.has(card.studentId) })),
  };
}

/** A Class Subject with its Class's year's Terms and the chosen one. No access check. */
async function classSubjectAndTerm(ctx: Ctx, input: { classSubjectId: number; termId?: number }) {
  const [found] = await ctx.db
    .select({
      classId: classSubject.classId,
      class: schoolClass.name,
      subject: subject.name,
      academicYearId: schoolClass.academicYearId,
    })
    .from(classSubject)
    .innerJoin(schoolClass, eq(schoolClass.id, classSubject.classId))
    .innerJoin(subject, eq(subject.id, classSubject.subjectId))
    .where(eq(classSubject.id, input.classSubjectId));
  if (!found) throw new NotFound();
  const terms = await yearTerms(ctx.db, found.academicYearId);
  return { ...found, terms, term: chooseTerm(terms, ctx.clock.today(), input.termId) };
}

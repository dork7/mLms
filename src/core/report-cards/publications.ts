// What a standing Publication freezes, and reading Publications back. While a Class's
// Report Cards for a Term are Published, nothing a Published card depends on may change.
//
// Every guard here runs inside the write's own transaction, after `requireOpenYear`, and
// holds the freeze lock until that transaction ends. Publish takes the lock exclusively, so
// a write in flight finishes before the Report Cards are read, and a later one sees the
// Publication. Taking the year's lock first everywhere keeps the order the same with Closing.
import { and, desc, eq, gt, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Db } from "@/db/client";
import {
  assessment,
  classSubject,
  enrollment,
  publishedReportCard,
  reportCardPublication,
  schoolClass,
  user,
} from "@/db/schema";
import type { Tx } from "../enrollment/enrollment";
import { ReportCardsPublished } from "../errors";

const REPORT_CARD_FREEZE_LOCK = 11;

/** Publish and unpublish: waits for every frozen-record write in flight, and holds new ones back. */
export async function takeFreezeLockExclusively(tx: Tx): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(${REPORT_CARD_FREEZE_LOCK})`);
}

async function holdFreezeLock(tx: Tx): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock_shared(${REPORT_CARD_FREEZE_LOCK})`);
}

const standing = isNull(reportCardPublication.unpublishedAt);

type FrozenMarks = {
  /** The Assessment's own Class is Published for this Term, so all its Marks are frozen. */
  wholeClass: boolean;
  /** Students whose Published Report Card, from any Class, covers this date. */
  students: Set<string>;
};

/**
 * Whose Marks are frozen on an Assessment of this Class on this date. A Mark is frozen by
 * the Assessment's own Class being Published, and also by the Student's Published Report
 * Card from another Class: a Term Grade counts Marks from every Class the Student was in.
 */
export async function frozenMarksOn(db: Db | Tx, at: { classId: number; date: string }): Promise<FrozenMarks> {
  const rows = await db
    .select({ classId: reportCardPublication.classId, studentId: publishedReportCard.studentId })
    .from(reportCardPublication)
    .leftJoin(publishedReportCard, eq(publishedReportCard.publicationId, reportCardPublication.id))
    .where(
      and(standing, lte(reportCardPublication.termStartDate, at.date), gte(reportCardPublication.termLastDay, at.date)),
    );
  return {
    wholeClass: rows.some((r) => r.classId === at.classId),
    students: new Set(rows.flatMap((r) => (r.studentId ? [r.studentId] : []))),
  };
}

/** Refuses writing these Students' Marks on an Assessment of this Class on this date. */
export async function requireMarksNotFrozen(
  tx: Tx,
  at: { classId: number; date: string },
  studentIds: string[],
): Promise<void> {
  if (studentIds.length === 0) return;
  await holdFreezeLock(tx);
  const frozen = await frozenMarksOn(tx, at);
  if (frozen.wholeClass || studentIds.some((id) => frozen.students.has(id))) throw new ReportCardsPublished();
}

/** Refuses changing an Assessment's maximum or weight, which reach every Mark on its roster. */
export async function requireAssessmentNotFrozen(tx: Tx, assessmentId: number): Promise<void> {
  await holdFreezeLock(tx);
  const [found] = await tx
    .select({ classId: classSubject.classId, date: assessment.date })
    .from(assessment)
    .innerJoin(classSubject, eq(classSubject.id, assessment.classSubjectId))
    .where(eq(assessment.id, assessmentId));
  if (!found) return;
  const frozen = await frozenMarksOn(tx, found);
  if (frozen.wholeClass) throw new ReportCardsPublished();
  if (frozen.students.size === 0) return;
  const onRoster = await tx
    .select({ studentId: enrollment.studentId })
    .from(enrollment)
    .where(
      and(
        eq(enrollment.classId, found.classId),
        inArray(enrollment.studentId, [...frozen.students]),
        lte(enrollment.startDate, found.date),
        or(isNull(enrollment.endDate), gte(enrollment.endDate, found.date)),
      ),
    );
  if (onRoster.length > 0) throw new ReportCardsPublished();
}

/** Refuses writing a remark on a Student's Report Card that's Published for this Term. */
export async function requireCardNotPublished(tx: Tx, studentId: string, termLastDay: string): Promise<void> {
  await holdFreezeLock(tx);
  const published = await studentsPublishedFor(tx, termLastDay, [studentId]);
  if (published.has(studentId)) throw new ReportCardsPublished();
}

/**
 * Refuses an Enrollment change in these Classes that shows after `afterDay`, if one of them
 * is Published for a Term ending later: it would change who is in the Class on that Term's
 * last day, so whose Issuing Class it is.
 */
export async function requireEnrollmentNotFrozen(tx: Tx, classIds: number[], afterDay: string): Promise<void> {
  await holdFreezeLock(tx);
  const [found] = await tx
    .select({ id: reportCardPublication.id })
    .from(reportCardPublication)
    .where(
      and(
        standing,
        inArray(reportCardPublication.classId, classIds),
        gt(reportCardPublication.termLastDay, afterDay),
      ),
    )
    .limit(1);
  if (found) throw new ReportCardsPublished();
}

/**
 * Refuses new Terms for a year that don't keep every Published Term's dates. Marks are frozen
 * by those dates and a Publication is found by them. Renaming a Term is fine.
 */
export async function requirePublishedTermsKept(
  tx: Tx,
  academicYearId: number,
  terms: { startDate: string; endDate: string }[],
): Promise<void> {
  await holdFreezeLock(tx);
  const published = await tx
    .select({ startDate: reportCardPublication.termStartDate, endDate: reportCardPublication.termLastDay })
    .from(reportCardPublication)
    .innerJoin(schoolClass, eq(schoolClass.id, reportCardPublication.classId))
    .where(and(standing, eq(schoolClass.academicYearId, academicYearId)));
  const kept = published.every((p) => terms.some((t) => t.startDate === p.startDate && t.endDate === p.endDate));
  if (!kept) throw new ReportCardsPublished();
}

/** Which of these Students have a Report Card Published for the Term ending on this day. */
export async function studentsPublishedFor(db: Db | Tx, termLastDay: string, studentIds: string[]): Promise<Set<string>> {
  if (studentIds.length === 0) return new Set();
  const rows = await db
    .select({ studentId: publishedReportCard.studentId })
    .from(publishedReportCard)
    .innerJoin(reportCardPublication, eq(reportCardPublication.id, publishedReportCard.publicationId))
    .where(
      and(
        standing,
        eq(reportCardPublication.termLastDay, termLastDay),
        inArray(publishedReportCard.studentId, studentIds),
      ),
    );
  return new Set(rows.map((r) => r.studentId));
}

export type PublicationRecord = {
  id: number;
  /** The Term's names as Published. Renaming the Term later doesn't change them. */
  termName: string;
  academicYearName: string;
  rankShown: boolean;
  publishedAt: Date;
  publishedBy: string;
  /** Null while it stands. */
  unpublishedAt: Date | null;
  unpublishedBy: string | null;
};

/** Every Publish of a Class's Report Cards for a Term, newest first, with who did what and when. */
export async function publicationRecords(db: Db | Tx, classId: number, termLastDay: string): Promise<PublicationRecord[]> {
  const unpublisher = alias(user, "unpublisher");
  return db
    .select({
      id: reportCardPublication.id,
      termName: reportCardPublication.termName,
      academicYearName: reportCardPublication.academicYearName,
      rankShown: reportCardPublication.rankShown,
      publishedAt: reportCardPublication.publishedAt,
      publishedBy: user.name,
      unpublishedAt: reportCardPublication.unpublishedAt,
      unpublishedBy: unpublisher.name,
    })
    .from(reportCardPublication)
    .innerJoin(user, eq(user.id, reportCardPublication.publishedBy))
    .leftJoin(unpublisher, eq(unpublisher.id, reportCardPublication.unpublishedBy))
    .where(and(eq(reportCardPublication.classId, classId), eq(reportCardPublication.termLastDay, termLastDay)))
    .orderBy(desc(reportCardPublication.id));
}

// The Closed-year guard: the one check that a write dated in an Academic Year is still
// allowed. Every such write calls `requireOpenYear` inside its own transaction.
import { eq } from "drizzle-orm";
import { academicYear, assessment, classSubject, schoolClass, term } from "@/db/schema";
import { requireId } from "../access";
import type { Ctx } from "../context";
import type { Tx } from "../enrollment/enrollment";
import { AcademicYearClosed, NotFound } from "../errors";

/** Any record that belongs to one Academic Year. */
export type InYear =
  | { academicYearId: number }
  | { termId: number }
  | { classId: number }
  | { classSubjectId: number }
  | { assessmentId: number };

/**
 * Refuses a write to a Closed Academic Year (`AcademicYearClosed`), or for a record that
 * doesn't exist (`NotFound`). It takes a transaction because it locks the year's row until
 * that transaction ends: Closing waits for the write to finish, and a write that started
 * after Closing waits and is then refused. So call it before the write, in the same
 * transaction.
 */
export async function requireOpenYear(tx: Tx, record: InYear): Promise<void> {
  const academicYearId = await yearOf(tx, record);
  const [year] = await tx
    .select({ closedAt: academicYear.closedAt })
    .from(academicYear)
    .where(eq(academicYear.id, academicYearId))
    .for("share");
  if (!year) throw new NotFound();
  if (year.closedAt) throw new AcademicYearClosed();
}

/**
 * Whether the record's year is Closed, without a lock: for deciding what to offer on
 * screen. It protects nothing, so a write still calls `requireOpenYear`.
 */
export async function isYearClosed(db: Ctx["db"], record: InYear): Promise<boolean> {
  const academicYearId = await yearOf(db, record);
  const [year] = await db
    .select({ closedAt: academicYear.closedAt })
    .from(academicYear)
    .where(eq(academicYear.id, academicYearId));
  if (!year) throw new NotFound();
  return year.closedAt !== null;
}

async function yearOf(db: Ctx["db"] | Tx, record: InYear): Promise<number> {
  const year = { id: schoolClass.academicYearId };
  let rows: { id: number }[];
  if ("academicYearId" in record) {
    requireId(record.academicYearId);
    return record.academicYearId;
  } else if ("termId" in record) {
    requireId(record.termId);
    rows = await db.select({ id: term.academicYearId }).from(term).where(eq(term.id, record.termId));
  } else if ("classId" in record) {
    requireId(record.classId);
    rows = await db.select(year).from(schoolClass).where(eq(schoolClass.id, record.classId));
  } else if ("classSubjectId" in record) {
    requireId(record.classSubjectId);
    rows = await db
      .select(year)
      .from(classSubject)
      .innerJoin(schoolClass, eq(schoolClass.id, classSubject.classId))
      .where(eq(classSubject.id, record.classSubjectId));
  } else {
    requireId(record.assessmentId);
    rows = await db
      .select(year)
      .from(assessment)
      .innerJoin(classSubject, eq(classSubject.id, assessment.classSubjectId))
      .innerJoin(schoolClass, eq(schoolClass.id, classSubject.classId))
      .where(eq(assessment.id, record.assessmentId));
  }
  if (!rows[0]) throw new NotFound();
  return rows[0].id;
}

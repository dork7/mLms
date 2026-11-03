// What a Student's approved leave does to their Marks (ticket 22). Approving turns the
// Student's Absent Marks on Assessments dated within the leave (inclusive) into Exempt, and
// records which Marks it changed in `leave_excused_mark`. Overriding the approval with a
// rejection puts exactly those Marks back to Absent, if they are still Exempt.
//
// Only Absent Marks change: scores, Exempt and Assessments with no Mark are left alone.
// A Mark that can't be written, because a Published Report Card freezes it or its Academic
// Year is Closed, is skipped and counted, never a reason to refuse the decision.
//
// Lock order, the same as every other Mark write: the Academic Years' rows (in id order),
// then the shared freeze lock, then the Mark rows.
import { and, eq, gte, inArray, lte, ne } from "drizzle-orm";
import { assessment, classSubject, leaveExcusedMark, leaveRequest, mark, schoolClass } from "@/db/schema";
import type { Tx } from "../enrollment/enrollment";
import { AcademicYearClosed, ReportCardsPublished } from "../errors";
import { requireMarksNotFrozen } from "../report-cards/publications";
import { requireOpenYear } from "../school/closed-year";

export type LeaveRequestDates = { id: number; studentId: string; startDate: string; endDate: string };

type MarkPlace = { assessmentId: number; date: string; classId: number; academicYearId: number };

const markPlace = {
  assessmentId: assessment.id,
  date: assessment.date,
  classId: classSubject.classId,
  academicYearId: schoolClass.academicYearId,
};

/**
 * Turns the Student's Absent Marks in the leave dates into Exempt and records them against
 * the request. Returns how many changed and how many were skipped because they are frozen.
 */
export async function excuseAbsentMarks(
  tx: Tx,
  request: LeaveRequestDates,
): Promise<{ exempted: number; frozen: number }> {
  const absent = await tx
    .select(markPlace)
    .from(mark)
    .innerJoin(assessment, eq(assessment.id, mark.assessmentId))
    .innerJoin(classSubject, eq(classSubject.id, assessment.classSubjectId))
    .innerJoin(schoolClass, eq(schoolClass.id, classSubject.classId))
    .where(
      and(
        eq(mark.studentId, request.studentId),
        eq(mark.status, "absent"),
        gte(assessment.date, request.startDate),
        lte(assessment.date, request.endDate),
      ),
    );
  const writable = await writableMarks(tx, request.studentId, absent);
  const changed =
    writable.length === 0
      ? []
      : await tx
          .update(mark)
          .set({ status: "exempt" })
          .where(
            and(
              eq(mark.studentId, request.studentId),
              inArray(mark.assessmentId, writable),
              eq(mark.status, "absent"), // re-checked under the row lock
            ),
          )
          .returning({ assessmentId: mark.assessmentId });
  if (changed.length > 0) {
    await tx
      .insert(leaveExcusedMark)
      .values(changed.map((c) => ({ ...c, studentId: request.studentId, leaveRequestId: request.id })))
      .onConflictDoUpdate({
        target: [leaveExcusedMark.assessmentId, leaveExcusedMark.studentId],
        set: { leaveRequestId: request.id },
      });
  }
  return { exempted: changed.length, frozen: absent.length - writable.length };
}

/**
 * Puts the Marks this request excused back to Absent. A Mark another approved Leave Request
 * of the Student also covers stays Exempt and is recorded against that one instead. A frozen
 * Mark stays Exempt and stays recorded, so a later rejection can still restore it.
 */
export async function restoreExcusedMarks(
  tx: Tx,
  request: LeaveRequestDates,
): Promise<{ restored: number; frozen: number }> {
  const excused = await tx
    .select(markPlace)
    .from(leaveExcusedMark)
    .innerJoin(
      mark,
      and(eq(mark.assessmentId, leaveExcusedMark.assessmentId), eq(mark.studentId, leaveExcusedMark.studentId)),
    )
    .innerJoin(assessment, eq(assessment.id, mark.assessmentId))
    .innerJoin(classSubject, eq(classSubject.id, assessment.classSubjectId))
    .innerJoin(schoolClass, eq(schoolClass.id, classSubject.classId))
    .where(and(eq(leaveExcusedMark.leaveRequestId, request.id), eq(mark.status, "exempt")));
  if (excused.length === 0) return { restored: 0, frozen: 0 };

  const otherLeave = await tx
    .select({ id: leaveRequest.id, startDate: leaveRequest.startDate, endDate: leaveRequest.endDate })
    .from(leaveRequest)
    .where(
      and(
        eq(leaveRequest.requesterId, request.studentId),
        eq(leaveRequest.status, "approved"),
        ne(leaveRequest.id, request.id),
      ),
    )
    .orderBy(leaveRequest.id);
  const stillExcused = new Map<number, number>(); // assessment id -> the other request's id
  for (const m of excused) {
    const other = otherLeave.find((l) => l.startDate <= m.date && m.date <= l.endDate);
    if (other) stillExcused.set(m.assessmentId, other.id);
  }

  const toRestore = excused.filter((m) => !stillExcused.has(m.assessmentId));
  const writable = await writableMarks(tx, request.studentId, toRestore);
  const restored =
    writable.length === 0
      ? []
      : await tx
          .update(mark)
          .set({ status: "absent" })
          .where(
            and(
              eq(mark.studentId, request.studentId),
              inArray(mark.assessmentId, writable),
              eq(mark.status, "exempt"), // re-checked under the row lock
            ),
          )
          .returning({ assessmentId: mark.assessmentId });
  if (restored.length > 0) {
    await tx.delete(leaveExcusedMark).where(
      and(
        eq(leaveExcusedMark.studentId, request.studentId),
        inArray(
          leaveExcusedMark.assessmentId,
          restored.map((r) => r.assessmentId),
        ),
      ),
    );
  }
  for (const [assessmentId, otherId] of stillExcused) {
    await tx
      .update(leaveExcusedMark)
      .set({ leaveRequestId: otherId })
      .where(and(eq(leaveExcusedMark.assessmentId, assessmentId), eq(leaveExcusedMark.studentId, request.studentId)));
  }
  return { restored: restored.length, frozen: toRestore.length - writable.length };
}

/**
 * The Assessments (of these Marks of one Student) whose Mark may be written: its Academic
 * Year isn't Closed and no Published Report Card freezes it. The guards are the ones every
 * Mark write calls, inside this transaction; their refusals mean "skip", not "fail".
 */
async function writableMarks(tx: Tx, studentId: string, marks: MarkPlace[]): Promise<number[]> {
  const closedYears = new Set<number>();
  for (const yearId of [...new Set(marks.map((m) => m.academicYearId))].sort((a, b) => a - b)) {
    try {
      await requireOpenYear(tx, { academicYearId: yearId });
    } catch (err) {
      if (!(err instanceof AcademicYearClosed)) throw err;
      closedYears.add(yearId);
    }
  }
  const frozenAt = new Map<string, boolean>(); // "classId date" -> frozen
  const writable: number[] = [];
  for (const m of marks) {
    if (closedYears.has(m.academicYearId)) continue;
    const at = `${m.classId} ${m.date}`;
    if (!frozenAt.has(at)) frozenAt.set(at, await isFrozen(tx, m, studentId));
    if (!frozenAt.get(at)) writable.push(m.assessmentId);
  }
  return writable;
}

async function isFrozen(tx: Tx, at: { classId: number; date: string }, studentId: string): Promise<boolean> {
  try {
    await requireMarksNotFrozen(tx, at, [studentId]);
    return false;
  } catch (err) {
    if (err instanceof ReportCardsPublished) return true;
    throw err;
  }
}

/** Used by `saveMarks`: Marks written by hand to anything but Exempt are no longer the leave's. */
export async function forgetExcusedMarks(tx: Tx, assessmentId: number, studentIds: string[]): Promise<void> {
  if (studentIds.length === 0) return;
  await tx
    .delete(leaveExcusedMark)
    .where(and(eq(leaveExcusedMark.assessmentId, assessmentId), inArray(leaveExcusedMark.studentId, studentIds)));
}

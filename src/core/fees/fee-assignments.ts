// Fee Assignments: one Student owing one Fee. The Admin applies a Fee to a Grade or to
// specific Students. Every read works out the Fee Status from the Payment Records.
import { and, asc, eq, gte, inArray, isNull, notExists, or, type SQL } from "drizzle-orm";
import {
  enrollment,
  fee,
  feeAssignment,
  grade,
  paymentMethodEnum,
  paymentRecord,
  schoolClass,
  student,
  user,
} from "@/db/schema";
import type { Db } from "@/db/client";
import { requireAdmin, requireCanSeeFees, requireId } from "../access";
import type { Ctx } from "../context";
import { NotFound } from "../errors";
import { type GradeInOrder, listGradesInOrder } from "../school/catalogue";
import { type FeeStatus, feeStatus } from "./fee-status";
import type { FeeRow } from "./fees";

export const PAYMENT_METHODS = paymentMethodEnum.enumValues;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type PaymentRecordRow = {
  id: number;
  amountFils: number;
  paidOn: string;
  method: PaymentMethod;
  reference: string;
};

export type FeeAssignmentView = {
  id: number;
  studentId: string;
  studentName: string;
  studentNumber: string;
  fee: FeeRow;
  waived: boolean;
  paidFils: number;
  status: FeeStatus;
  /** Oldest first. */
  payments: PaymentRecordRow[];
};

/**
 * Applies a Fee to every Student in a Grade: those with an Enrollment in one of the
 * Grade's Classes that hasn't ended by today (so one starting later counts too).
 * A Student who already owes this Fee is left as they are. Returns how many were added.
 */
export async function applyFeeToGrade(
  ctx: Ctx,
  input: { feeId: number; gradeId: number },
): Promise<{ assigned: number }> {
  requireAdmin(ctx.actor);
  await requireFee(ctx.db, input.feeId);
  requireId(input.gradeId);
  const [knownGrade] = await ctx.db.select({ id: grade.id }).from(grade).where(eq(grade.id, input.gradeId));
  if (!knownGrade) throw new NotFound("no such Grade");
  const inGrade = await ctx.db
    .selectDistinct({ studentId: enrollment.studentId })
    .from(enrollment)
    .innerJoin(schoolClass, eq(schoolClass.id, enrollment.classId))
    .where(
      and(
        eq(schoolClass.gradeId, input.gradeId),
        or(isNull(enrollment.endDate), gte(enrollment.endDate, ctx.clock.today())),
      ),
    );
  return assign(ctx.db, input.feeId, inGrade.map((r) => r.studentId));
}

/** Applies a Fee to the given Students. One who already owes it is left as they are. */
export async function applyFeeToStudents(
  ctx: Ctx,
  input: { feeId: number; studentIds: string[] },
): Promise<{ assigned: number }> {
  requireAdmin(ctx.actor);
  await requireFee(ctx.db, input.feeId);
  const studentIds = [...new Set(input.studentIds)];
  const known = studentIds.length
    ? await ctx.db.select({ id: student.userId }).from(student).where(inArray(student.userId, studentIds))
    : [];
  if (known.length !== studentIds.length) throw new NotFound("no such Student");
  return assign(ctx.db, input.feeId, studentIds);
}

/** Waives a Fee Assignment: it reads Waived, whatever was paid, until `unwaiveFeeAssignment`. */
export async function waiveFeeAssignment(ctx: Ctx, input: { feeAssignmentId: number }): Promise<void> {
  requireAdmin(ctx.actor);
  await setWaived(ctx, input.feeAssignmentId, { waivedAt: ctx.clock.now(), waivedBy: ctx.actor.userId });
}

/** Undoes a waiver: the Fee Status is worked out from the Payment Records again. */
export async function unwaiveFeeAssignment(ctx: Ctx, input: { feeAssignmentId: number }): Promise<void> {
  requireAdmin(ctx.actor);
  await setWaived(ctx, input.feeAssignmentId, { waivedAt: null, waivedBy: null });
}

async function setWaived(
  ctx: Ctx,
  feeAssignmentId: number,
  values: { waivedAt: Date | null; waivedBy: string | null },
): Promise<void> {
  requireId(feeAssignmentId);
  const updated = await ctx.db
    .update(feeAssignment)
    .set(values)
    .where(eq(feeAssignment.id, feeAssignmentId))
    .returning({ id: feeAssignment.id });
  if (updated.length === 0) throw new NotFound("no such Fee Assignment");
}

/**
 * A Student's Fee Assignments, soonest due first, each with its Payment Records and Fee
 * Status: the Admin and that Student only. Later Fee features (Overdue, the Fee Alert,
 * reminders) should build on this, or on `feeAssignmentViews` once they've checked access.
 */
export async function studentFeeAssignments(ctx: Ctx, input: { studentId: string }): Promise<FeeAssignmentView[]> {
  requireCanSeeFees(ctx.actor, input.studentId);
  return feeAssignmentViews(ctx.db, eq(feeAssignment.studentId, input.studentId));
}

/** One Fee Assignment, for the Admin to log Payment Records against or waive. */
export async function getFeeAssignment(ctx: Ctx, input: { feeAssignmentId: number }): Promise<FeeAssignmentView> {
  requireAdmin(ctx.actor);
  requireId(input.feeAssignmentId);
  const [found] = await feeAssignmentViews(ctx.db, eq(feeAssignment.id, input.feeAssignmentId));
  if (!found) throw new NotFound("no such Fee Assignment");
  return found;
}

/** What the Admin can apply a Fee to: every Grade (in Grade order) and the Students who don't owe it yet. */
export async function feeApplyChoices(
  ctx: Ctx,
  input: { feeId: number },
): Promise<{ grades: GradeInOrder[]; students: { id: string; name: string; studentNumber: string }[] }> {
  requireAdmin(ctx.actor);
  await requireFee(ctx.db, input.feeId);
  const owing = ctx.db
    .select({ id: feeAssignment.id })
    .from(feeAssignment)
    .where(and(eq(feeAssignment.feeId, input.feeId), eq(feeAssignment.studentId, student.userId)));
  const students = await ctx.db
    .select({ id: student.userId, name: user.name, studentNumber: student.studentNumber })
    .from(student)
    .innerJoin(user, eq(user.id, student.userId))
    .where(notExists(owing))
    .orderBy(asc(user.name), asc(student.studentNumber));
  return { grades: await listGradesInOrder(ctx), students };
}

/** A Fee with every Fee Assignment of it, by Student name. */
export async function getFee(ctx: Ctx, input: { feeId: number }): Promise<FeeRow & { assignments: FeeAssignmentView[] }> {
  requireAdmin(ctx.actor);
  const found = await requireFee(ctx.db, input.feeId);
  return { ...found, assignments: await feeAssignmentViews(ctx.db, eq(feeAssignment.feeId, input.feeId)) };
}

/**
 * The Fee Assignments matching `where` (a condition over `feeAssignment`, `fee` or the
 * Student's `user`), each with its Payment Records and Fee Status, by Student name and
 * then due date. No access check: callers guard first.
 */
export async function feeAssignmentViews(db: Db, where: SQL | undefined): Promise<FeeAssignmentView[]> {
  const rows = await db
    .select({
      id: feeAssignment.id,
      studentId: feeAssignment.studentId,
      studentName: user.name,
      studentNumber: student.studentNumber,
      waivedAt: feeAssignment.waivedAt,
      fee: { id: fee.id, name: fee.name, amountFils: fee.amountFils, dueDate: fee.dueDate },
    })
    .from(feeAssignment)
    .innerJoin(fee, eq(fee.id, feeAssignment.feeId))
    .innerJoin(student, eq(student.userId, feeAssignment.studentId))
    .innerJoin(user, eq(user.id, feeAssignment.studentId))
    .where(where)
    .orderBy(asc(user.name), asc(student.studentNumber), asc(fee.dueDate), asc(fee.name), asc(feeAssignment.id));
  const payments = rows.length
    ? await db
        .select({
          id: paymentRecord.id,
          feeAssignmentId: paymentRecord.feeAssignmentId,
          amountFils: paymentRecord.amountFils,
          paidOn: paymentRecord.paidOn,
          method: paymentRecord.method,
          reference: paymentRecord.reference,
        })
        .from(paymentRecord)
        .where(inArray(paymentRecord.feeAssignmentId, rows.map((r) => r.id)))
        .orderBy(asc(paymentRecord.paidOn), asc(paymentRecord.id))
    : [];
  return rows.map(({ waivedAt, ...row }) => {
    const own = payments.filter((p) => p.feeAssignmentId === row.id).map(({ feeAssignmentId: _, ...p }) => p);
    const paidFils = own.reduce((sum, p) => sum + p.amountFils, 0);
    const waived = waivedAt !== null;
    return { ...row, waived, paidFils, status: feeStatus({ amountFils: row.fee.amountFils, paidFils, waived }), payments: own };
  });
}

async function requireFee(db: Db, feeId: number): Promise<FeeRow> {
  requireId(feeId);
  const [found] = await db
    .select({ id: fee.id, name: fee.name, amountFils: fee.amountFils, dueDate: fee.dueDate })
    .from(fee)
    .where(eq(fee.id, feeId));
  if (!found) throw new NotFound("no such Fee");
  return found;
}

async function assign(db: Db, feeId: number, studentIds: string[]): Promise<{ assigned: number }> {
  if (studentIds.length === 0) return { assigned: 0 };
  const added = await db
    .insert(feeAssignment)
    .values(studentIds.map((studentId) => ({ feeId, studentId })))
    .onConflictDoNothing()
    .returning({ id: feeAssignment.id });
  return { assigned: added.length };
}

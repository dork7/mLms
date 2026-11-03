// One Payment Record as a document to download: the data its PDF is rendered from. It comes
// from the same query as the Fee screens, so the PDF can't disagree with what's shown.
import { eq } from "drizzle-orm";
import { feeAssignment, paymentRecord } from "@/db/schema";
import { requireCanSeeFees, requireId, requireRole } from "../access";
import type { Ctx } from "../context";
import { NotFound } from "../errors";
import { pdfFileName } from "../file-name";
import { schoolName } from "../school/school-name";
import { feeAssignmentViews, type PaymentRecordRow } from "./fee-assignments";
import type { FeeStatus } from "./fee-status";
import type { FeeRow } from "./fees";

export type PrintablePaymentRecord = {
  /** Plain ASCII, so it's safe in a Content-Disposition header. */
  fileName: string;
  school: string;
  /** The day it was made: the Fee Status and amount paid are as of this date. */
  asOf: string;
  student: { name: string; studentNumber: string };
  fee: FeeRow;
  payment: PaymentRecordRow;
  /** The Fee Assignment's Fee Status and everything paid towards it to date. */
  status: FeeStatus;
  paidFils: number;
};

/** One Payment Record: for the Admin, and for the Student it was paid for. */
export async function paymentRecordExport(
  ctx: Ctx,
  input: { paymentRecordId: number },
): Promise<PrintablePaymentRecord> {
  requireRole(ctx.actor, "admin", "student");
  requireId(input.paymentRecordId);
  const [found] = await ctx.db
    .select({ feeAssignmentId: paymentRecord.feeAssignmentId, studentId: feeAssignment.studentId })
    .from(paymentRecord)
    .innerJoin(feeAssignment, eq(feeAssignment.id, paymentRecord.feeAssignmentId))
    .where(eq(paymentRecord.id, input.paymentRecordId));
  if (!found) throw new NotFound("no such Payment Record");
  requireCanSeeFees(ctx.actor, found.studentId);

  const [view] = await feeAssignmentViews(ctx.db, eq(feeAssignment.id, found.feeAssignmentId));
  const payment = view.payments.find((p) => p.id === input.paymentRecordId)!;
  return {
    fileName: pdfFileName("payment-record", view.studentNumber, String(payment.id)),
    school: schoolName(),
    asOf: ctx.clock.today(),
    student: { name: view.studentName, studentNumber: view.studentNumber },
    fee: view.fee,
    payment,
    status: view.status,
    paidFils: view.paidFils,
  };
}

// Payment Records: one logged payment against a Fee Assignment, with its amount, date,
// method and reference. Logging one is how a Fee Assignment's Fee Status changes.
import { eq } from "drizzle-orm";
import { feeAssignment, paymentRecord } from "@/db/schema";
import { requireAdmin, requireId } from "../access";
import type { Ctx } from "../context";
import { isCalendarDate } from "../dates";
import { InvalidInput, NotFound } from "../errors";
import { PAYMENT_METHODS, type PaymentMethod } from "./fee-assignments";
import { parseAed } from "./money";

const MAX_REFERENCE = 200;

/**
 * `amount` is AED as the Admin typed it, `method` is cash, bank_transfer or cheque, and
 * `reference` (a receipt, transfer or cheque number) may be blank. A payment can't be
 * dated after today. Paying more than is owed is allowed and reads Paid.
 */
export async function logPaymentRecord(
  ctx: Ctx,
  input: { feeAssignmentId: number; amount: string; date: string; method: string; reference: string },
): Promise<{ id: number }> {
  requireAdmin(ctx.actor);
  requireId(input.feeAssignmentId);
  const amountFils = parseAed(input.amount);
  if (amountFils === null) throw new InvalidInput("errors.paymentAmountInvalid");
  if (!isCalendarDate(input.date) || input.date > ctx.clock.today()) {
    throw new InvalidInput("errors.paymentDateInvalid");
  }
  const method = input.method;
  if (!isPaymentMethod(method)) throw new InvalidInput("errors.paymentMethodInvalid");
  const reference = input.reference.trim();
  if (reference.length > MAX_REFERENCE) throw new InvalidInput("errors.paymentReferenceTooLong");

  return ctx.db.transaction(async (tx) => {
    const [assignment] = await tx
      .select({ waivedAt: feeAssignment.waivedAt })
      .from(feeAssignment)
      .where(eq(feeAssignment.id, input.feeAssignmentId))
      .for("update");
    if (!assignment) throw new NotFound("no such Fee Assignment");
    if (assignment.waivedAt) throw new InvalidInput("errors.feeAssignmentWaived");
    const [row] = await tx
      .insert(paymentRecord)
      .values({
        feeAssignmentId: input.feeAssignmentId,
        amountFils,
        paidOn: input.date,
        method,
        reference,
        recordedAt: ctx.clock.now(),
        recordedBy: ctx.actor.userId,
      })
      .returning({ id: paymentRecord.id });
    return row;
  });
}

function isPaymentMethod(value: string): value is PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(value);
}

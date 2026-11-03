// Fee Status: worked out from a Fee Assignment's Payment Records every time it's read,
// never stored, so it can't drift from the payments.

export type FeeStatus = "unpaid" | "partiallyPaid" | "paid" | "waived";

/** Waived if waived, otherwise Paid if payments ≥ the amount, Partially Paid if > 0, else Unpaid. */
export function feeStatus(a: { amountFils: number; paidFils: number; waived: boolean }): FeeStatus {
  if (a.waived) return "waived";
  if (a.paidFils >= a.amountFils) return "paid";
  if (a.paidFils > 0) return "partiallyPaid";
  return "unpaid";
}

/**
 * Overdue: the one rule for it. Past the due date by the Clock (the day after the due
 * date at the earliest; the due date itself isn't Overdue) and not Paid or Waived, so
 * Unpaid or Partially Paid. Worked out on every read like the Fee Status, never stored.
 * `today` is `clock.today()`.
 */
export function isOverdue(a: { dueDate: string; status: FeeStatus }, today: string): boolean {
  return a.dueDate < today && (a.status === "unpaid" || a.status === "partiallyPaid");
}

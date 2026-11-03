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
 * Overdue: past the due date (the due day itself isn't Overdue yet) and not Paid or Waived.
 * Defined here for Fee Reminders (ticket 21); ticket 20 (Fee Alert) defines Overdue too, and
 * the two are to be merged into one.
 */
export function isOverdueOn(today: string, a: { dueDate: string; status: FeeStatus }): boolean {
  return a.dueDate < today && a.status !== "paid" && a.status !== "waived";
}

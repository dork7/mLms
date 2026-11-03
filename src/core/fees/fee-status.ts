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

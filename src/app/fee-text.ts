// How Fee amounts and Payment Records read, on screen and in the Payment Record PDF.
import type { PaymentRecordRow } from "@/core/fees/fee-assignments";
import { formatAed } from "@/core/fees/money";
import { t } from "@/i18n";

/** "AED 400.00 paid of AED 1,000.00". */
export function paidText(a: { paidFils: number; fee: { amountFils: number } }): string {
  return t("fees.paidOf", { paid: formatAed(a.paidFils), amount: formatAed(a.fee.amountFils) });
}

/** "AED 400.00 on 2026-09-28 · Bank transfer · TRX-77". */
export function paymentText(p: PaymentRecordRow): string {
  return [t("fees.paymentLine", { amount: formatAed(p.amountFils), date: p.paidOn }), t(`fees.methods.${p.method}`), p.reference]
    .filter(Boolean)
    .join(t("common.separator"));
}

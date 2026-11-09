// How Fee amounts and Payment Records read, on screen and in the Payment Record PDF.
import { dateText } from "@/app/date-text";
import type { PaymentRecordRow } from "@/core/fees/fee-assignments";
import { formatAed } from "@/core/fees/money";
import { t } from "@/i18n";

/** "AED 400.00 paid of AED 1,000.00". */
export function paidText(a: { paidFils: number; fee: { amountFils: number } }): string {
  return t("fees.paidOf", { paid: formatAed(a.paidFils), amount: formatAed(a.fee.amountFils) });
}

/** "AED 400.00 on Sep 28, 2026 · Bank transfer · TRX-77". */
export function paymentText(p: PaymentRecordRow): string {
  return [t("fees.paymentLine", { amount: formatAed(p.amountFils), date: dateText(p.paidOn) }), t(`fees.methods.${p.method}`), p.reference]
    .filter(Boolean)
    .join(t("common.separator"));
}

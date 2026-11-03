// The document a Payment Record PDF is rendered from. It's a string because react-dom/server
// isn't available to route handlers, and it reads Fees with the same text helpers as the
// screens (`fee-text.ts`). Everything from the database goes through `escaped`.
import type { PrintablePaymentRecord } from "@/core/fees/payment-record-export";
import { formatAed } from "@/core/fees/money";
import { dir, locale, t } from "@/i18n";
import { escaped } from "./escaped";
import { paidText } from "./fee-text";

export function paymentRecordHtml(record: PrintablePaymentRecord): string {
  const { school, student, fee, payment } = record;
  return `<!DOCTYPE html>
<html lang="${escaped(locale)}" dir="${escaped(dir)}">
<head><meta charset="utf-8"><title>${escaped(t("paymentRecordPdf.title"))}</title><style>${STYLES}</style></head>
<body>
  <p class="school">${escaped(school)}</p>
  <h1>${escaped(t("paymentRecordPdf.title"))}</h1>
  <h2>${escaped(t("termGrades.studentLine", { name: student.name, studentNumber: student.studentNumber }))}</h2>
  <h3>${escaped(t("paymentRecordPdf.paymentHeading"))}</h3>
  ${details([
    [t("paymentRecordPdf.amount"), formatAed(payment.amountFils)],
    [t("paymentRecordPdf.date"), payment.paidOn],
    [t("paymentRecordPdf.method"), t(`fees.methods.${payment.method}`)],
    [t("paymentRecordPdf.reference"), payment.reference || t("paymentRecordPdf.noReference")],
  ])}
  <h3>${escaped(t("paymentRecordPdf.feeHeading"))}</h3>
  ${details([
    [t("fees.feeLabel"), fee.name],
    [t("paymentRecordPdf.feeAmount"), formatAed(fee.amountFils)],
    [t("paymentRecordPdf.dueDate"), fee.dueDate],
  ])}
  <h3>${escaped(t("paymentRecordPdf.statusHeading", { date: record.asOf }))}</h3>
  ${details([
    [t("paymentRecordPdf.status"), t(`fees.status.${record.status}`)],
    [t("paymentRecordPdf.paidToDate"), paidText(record)],
  ])}
</body>
</html>`;
}

function details(rows: [label: string, value: string][]): string {
  return `<dl>${rows.map(([label, value]) => `<div><dt>${escaped(label)}</dt><dd>${escaped(value)}</dd></div>`).join("")}</dl>`;
}

// Logical properties only, like globals.css. Nothing loads from outside the document.
const STYLES = `
* { box-sizing: border-box; }
body { margin: 0; color: #1a1a1a; font: 11pt/1.45 "Noto Sans", "Liberation Sans", Arial, sans-serif; overflow-wrap: anywhere; }
.school { font-size: 13pt; font-weight: bold; margin-block: 0 1rem; padding-block-end: 0.5rem; border-block-end: 2px solid #1a1a1a; }
h1 { font-size: 18pt; margin-block: 0 0.25rem; }
h2 { font-size: 13pt; margin-block: 0 0.5rem; }
h3 { font-size: 11pt; margin-block: 1.25rem 0.25rem; }
dl { margin: 0; border-block-start: 1px solid #d8d8d4; }
dl > div { display: flex; justify-content: space-between; gap: 1rem; padding-block: 0.4rem; border-block-end: 1px solid #d8d8d4; break-inside: avoid; }
dt { color: #555; }
dd { margin: 0; font-weight: bold; text-align: end; white-space: pre-wrap; }
`;

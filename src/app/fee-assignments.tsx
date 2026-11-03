// A Student's Fee Assignments with their Fee Status and Payment Records. Shown to the
// Student on /student/fees and to the Admin on the Student's profile.
import Link from "next/link";
import type { FeeAssignmentView, PaymentRecordRow } from "@/core/fees/fee-assignments";
import { formatAed } from "@/core/fees/money";
import { t } from "@/i18n";

export function FeeAssignments({
  assignments,
  title = t("fees.title"),
  linkForAdmin = false,
}: {
  assignments: FeeAssignmentView[];
  title?: string;
  linkForAdmin?: boolean;
}) {
  return (
    <section className="card" aria-labelledby="fee-assignments">
      <h2 id="fee-assignments">{title}</h2>
      {assignments.length === 0 ? (
        <p>{t("fees.noneForStudent")}</p>
      ) : (
        <ul className="list">
          {assignments.map((a) => (
            <li key={a.id}>
              <div className="list-item">
                <div>
                  <strong>{a.fee.name}</strong>
                  <div className="muted">{t("fees.due", { date: a.fee.dueDate })}</div>
                  <div>{paidText(a)}</div>
                </div>
                <div>
                  <FeeStatusLabel assignment={a} />
                  {linkForAdmin && (
                    <div>
                      <Link href={`/admin/fees/assignments/${a.id}`}>{t("fees.open")}</Link>
                    </div>
                  )}
                </div>
              </div>
              <PaymentRecords payments={a.payments} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The Fee Status, followed by "Overdue" while it is. */
export function FeeStatusLabel({ assignment }: { assignment: Pick<FeeAssignmentView, "status" | "overdue"> }) {
  return (
    <>
      <strong>{t(`fees.status.${assignment.status}`)}</strong>
      {assignment.overdue && (
        <>
          {t("common.separator")}
          <span className="fee-overdue">{t("fees.overdue")}</span>
        </>
      )}
    </>
  );
}

export function PaymentRecords({ payments }: { payments: PaymentRecordRow[] }) {
  if (payments.length === 0) return null;
  return (
    <ul className="list payment-records" aria-label={t("fees.paymentRecordsTitle")}>
      {payments.map((p) => (
        <li key={p.id} className="muted">
          {paymentText(p)}
        </li>
      ))}
    </ul>
  );
}

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

// A Student's Fee Assignments with their Fee Status and Payment Records. Shown to the
// Student on /student/fees and to the Admin on the Student's profile. Each Payment Record
// links to its PDF.
import Link from "next/link";
import type { FeeAssignmentView, PaymentRecordRow } from "@/core/fees/fee-assignments";
import { t } from "@/i18n";
import { paidText, paymentText } from "./fee-text";

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
                  <strong>{t(`fees.status.${a.status}`)}</strong>
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

export function PaymentRecords({ payments }: { payments: PaymentRecordRow[] }) {
  if (payments.length === 0) return null;
  return (
    <ul className="list payment-records" aria-label={t("fees.paymentRecordsTitle")}>
      {payments.map((p) => (
        <li key={p.id} className="muted">
          <span>{paymentText(p)}</span>{" "}
          {/* A plain link: next/link would try to route to a file. */}
          <a href={`/payment-records/${p.id}/pdf`} download>
            {t("paymentRecordPdf.download")}
          </a>
        </li>
      ))}
    </ul>
  );
}

export { paidText, paymentText };

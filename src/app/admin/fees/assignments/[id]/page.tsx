// One Fee Assignment: its Fee Status, its Payment Records, the form to log another, and
// waiving (or undoing a waiver).
import Link from "next/link";
import { getFeeAssignment, PAYMENT_METHODS } from "@/core/fees/fee-assignments";
import { formatAed } from "@/core/fees/money";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import { PaymentRecords } from "../../../../fee-assignments";
import { setWaived } from "../../actions";
import { PaymentRecordForm } from "../../forms";

export default async function FeeAssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const feeAssignmentId = Number((await params).id);
  let assignment;
  try {
    assignment = await asCurrentActor((ctx) => getFeeAssignment(ctx, { feeAssignmentId }));
  } catch (err) {
    return (
      <main className="page">
        <p className="error">{t(refusalKey(err))}</p>
      </main>
    );
  }
  const { fee } = assignment;

  return (
    <main className="page">
      <header className="topbar">
        <h1>{t("fees.assignmentTitle", { fee: fee.name, student: assignment.studentName })}</h1>
        <Link href={`/admin/fees/${fee.id}`}>{t("fees.backToFee", { name: fee.name })}</Link>
      </header>
      <section className="card">
        <dl className="details">
          <div>
            <dt>{t("fees.studentLabel")}</dt>
            <dd>
              <Link href={`/admin/students/${assignment.studentId}`}>{assignment.studentName}</Link>{" "}
              <span className="muted">{assignment.studentNumber}</span>
            </dd>
          </div>
          <div>
            <dt>{t("fees.feeLabel")}</dt>
            <dd>
              {fee.name}
              {t("common.separator")}
              {formatAed(fee.amountFils)}
              {t("common.separator")}
              {t("fees.due", { date: fee.dueDate })}
            </dd>
          </div>
          <div>
            <dt>{t("fees.paidLabel")}</dt>
            <dd>{formatAed(assignment.paidFils)}</dd>
          </div>
          <div>
            <dt>{t("fees.statusLabel")}</dt>
            <dd>
              <strong>{t(`fees.status.${assignment.status}`)}</strong>
            </dd>
          </div>
        </dl>
        <form action={setWaived}>
          <input type="hidden" name="feeAssignmentId" value={assignment.id} />
          <input type="hidden" name="waive" value={String(!assignment.waived)} />
          <button className="button-link" type="submit">
            {assignment.waived ? t("fees.unwaive") : t("fees.waive")}
          </button>
        </form>
      </section>
      <section className="card" aria-labelledby="payments-heading">
        <h2 id="payments-heading">{t("fees.paymentRecordsTitle")}</h2>
        {assignment.payments.length === 0 ? <p>{t("fees.noPayments")}</p> : <PaymentRecords payments={assignment.payments} />}
      </section>
      <section className="card" aria-labelledby="log-payment-heading">
        <h2 id="log-payment-heading">{t("fees.logPaymentTitle")}</h2>
        {assignment.waived ? (
          <p>{t("fees.waivedNotice")}</p>
        ) : (
          <PaymentRecordForm
            feeAssignmentId={assignment.id}
            methods={PAYMENT_METHODS.map((m) => ({ id: m, name: t(`fees.methods.${m}`) }))}
          />
        )}
      </section>
    </main>
  );
}

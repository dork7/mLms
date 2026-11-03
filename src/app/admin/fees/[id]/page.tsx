// One Fee: its Fee Assignments with each Fee Status, and the forms to apply it to a
// Grade or to specific Students.
import Link from "next/link";
import { feeApplyChoices, getFee } from "@/core/fees/fee-assignments";
import { formatAed } from "@/core/fees/money";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import { paidText } from "../../../fee-assignments";
import { ApplyToGradeForm, ApplyToStudentsForm } from "../forms";

export default async function FeePage({ params }: { params: Promise<{ id: string }> }) {
  const feeId = Number((await params).id);
  let data;
  try {
    data = await asCurrentActor((ctx) => Promise.all([getFee(ctx, { feeId }), feeApplyChoices(ctx, { feeId })]));
  } catch (err) {
    return (
      <main className="page">
        <p className="error">{t(refusalKey(err))}</p>
      </main>
    );
  }
  const [fee, choices] = data;

  return (
    <main className="page">
      <header className="topbar">
        <h1>{fee.name}</h1>
        <Link href="/admin/fees">{t("fees.backToList")}</Link>
      </header>
      <section className="card">
        <dl className="details">
          <div>
            <dt>{t("fees.amount")}</dt>
            <dd>{formatAed(fee.amountFils)}</dd>
          </div>
          <div>
            <dt>{t("fees.dueDate")}</dt>
            <dd>{fee.dueDate}</dd>
          </div>
        </dl>
      </section>
      <section className="card" aria-labelledby="assignments-heading">
        <h2 id="assignments-heading">{t("fees.assignmentsTitle")}</h2>
        {fee.assignments.length === 0 ? (
          <p>{t("fees.noAssignments")}</p>
        ) : (
          <ul className="list">
            {fee.assignments.map((a) => (
              <li key={a.id} className="list-item">
                <div>
                  <Link href={`/admin/fees/assignments/${a.id}`}>
                    <strong>{a.studentName}</strong>
                  </Link>
                  <div className="muted">{a.studentNumber}</div>
                  <div className="muted">{paidText(a)}</div>
                </div>
                <strong>{t(`fees.status.${a.status}`)}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card">
        <h2>{t("fees.applyToGrade")}</h2>
        <ApplyToGradeForm feeId={fee.id} grades={choices.grades} />
      </section>
      <section className="card">
        <h2>{t("fees.applyToStudents")}</h2>
        <ApplyToStudentsForm
          feeId={fee.id}
          students={choices.students.map((s) => ({
            id: s.id,
            name: t("fees.studentOption", { name: s.name, number: s.studentNumber }),
          }))}
        />
      </section>
    </main>
  );
}

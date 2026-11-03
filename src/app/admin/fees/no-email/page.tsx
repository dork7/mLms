// The no-email report: every Student Fee Reminders can't reach, and whether each still
// owes a Fee, so the office can collect an address or contact the family another way.
import Link from "next/link";
import { noEmailReport } from "@/core/fees/fee-reminders";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";

export default async function NoEmailReportPage() {
  let rows;
  try {
    rows = await asCurrentActor((ctx) => noEmailReport(ctx));
  } catch (err) {
    return (
      <main className="page">
        <p className="error">{t(refusalKey(err))}</p>
      </main>
    );
  }
  const r = "feeReminders.noEmail";

  return (
    <main className="page">
      <header className="topbar">
        <h1>{t(`${r}.title`)}</h1>
        <Link href="/admin/fees">{t("fees.backToList")}</Link>
      </header>
      <section className="card">
        <p className="muted">{t(`${r}.hint`)}</p>
        {rows.length === 0 ? (
          <p>{t(`${r}.none`)}</p>
        ) : (
          <table className="report-table">
            <thead>
              <tr>
                <th scope="col">{t(`${r}.student`)}</th>
                <th scope="col">{t(`${r}.guardianContact`)}</th>
                <th scope="col">{t(`${r}.outstanding`)}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.studentId}>
                  <th scope="row">
                    <Link href={`/admin/students/${row.studentId}`}>
                      {t(`${r}.studentLine`, { name: row.name, number: row.studentNumber })}
                    </Link>
                  </th>
                  <td>{row.guardianContact}</td>
                  <td>{row.hasOutstandingFee ? t(`${r}.yes`) : t(`${r}.no`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

// The Admin's Fees: every Fee, soonest due first, the form to define one, and the Fee
// Reminder timings with the link to the no-email report.
import Link from "next/link";
import { formatAed } from "@/core/fees/money";
import { getFeeReminderSettings } from "@/core/fees/fee-reminders";
import { listFees } from "@/core/fees/fees";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import { DefineFeeForm, FeeReminderSettingsForm } from "./forms";

export default async function FeesPage() {
  let data;
  try {
    data = await asCurrentActor((ctx) => Promise.all([listFees(ctx), getFeeReminderSettings(ctx)]));
  } catch (err) {
    return (
      <main className="page">
        <p className="error">{t(refusalKey(err))}</p>
      </main>
    );
  }

  const [fees, reminders] = data;

  return (
    <main className="page">
      <header className="topbar">
        <h1>{t("fees.title")}</h1>
        <Link href="/admin">{t("nav.dashboard")}</Link>
      </header>
      <section className="card">
        {fees.length === 0 ? (
          <p>{t("fees.none")}</p>
        ) : (
          <ul className="list">
            {fees.map((fee) => (
              <li key={fee.id} className="list-item">
                <div>
                  <Link href={`/admin/fees/${fee.id}`}>
                    <strong>{fee.name}</strong>
                  </Link>
                  <div className="muted">{t("fees.due", { date: fee.dueDate })}</div>
                </div>
                <span>{formatAed(fee.amountFils)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card">
        <h2>{t("fees.defineTitle")}</h2>
        <DefineFeeForm />
      </section>
      <section className="card" aria-labelledby="fee-reminders">
        <h2 id="fee-reminders">{t("feeReminders.title")}</h2>
        <p className="muted">{t("feeReminders.hint")}</p>
        <FeeReminderSettingsForm leadDays={reminders.leadDays} intervalDays={reminders.intervalDays} />
        <p>
          <Link href="/admin/fees/no-email">{t("feeReminders.noEmailLink")}</Link>
        </p>
      </section>
    </main>
  );
}

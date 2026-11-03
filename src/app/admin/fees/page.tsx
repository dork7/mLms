// The Admin's Fees: every Fee, soonest due first, and the form to define one.
import Link from "next/link";
import { formatAed } from "@/core/fees/money";
import { listFees } from "@/core/fees/fees";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import { DefineFeeForm } from "./forms";

export default async function FeesPage() {
  let fees;
  try {
    fees = await asCurrentActor((ctx) => listFees(ctx));
  } catch (err) {
    return (
      <main className="page">
        <p className="error">{t(refusalKey(err))}</p>
      </main>
    );
  }

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
    </main>
  );
}

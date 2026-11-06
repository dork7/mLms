// A Student's own Published Report Cards. A Report Card that isn't Published isn't here.
import Link from "next/link";
import { studentFeeAlert } from "@/core/fees/fee-alert";
import { studentReportCards } from "@/core/report-cards/publish";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import { FeeAlert } from "../../fee-alert";
import { PublishedReportCards } from "../../published-report-cards";

export default async function MyReportCardsPage() {
  let data;
  try {
    data = await asCurrentActor((ctx) =>
      Promise.all([
        studentReportCards(ctx, { studentId: ctx.actor.userId }),
        studentFeeAlert(ctx, { studentId: ctx.actor.userId }),
      ]),
    );
  } catch (err) {
    return (
      <main className="page">
        <p className="error">{t(refusalKey(err))}</p>
      </main>
    );
  }

  const [cards, feeAlert] = data;

  return (
    <main className="page">
      <header className="topbar">
        <h1>{t("publish.myTitle")}</h1>
        <Link href="/student">{t("nav.dashboard")}</Link>
      </header>
      <FeeAlert alert={feeAlert} viewer="student" />
      {cards.length === 0 && (
        <section className="card">
          <p>{t("publish.myEmpty")}</p>
        </section>
      )}
      <PublishedReportCards cards={cards} />
    </main>
  );
}

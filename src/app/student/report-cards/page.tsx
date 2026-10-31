// A Student's own Published Report Cards. A Report Card that isn't Published isn't here.
import Link from "next/link";
import { studentReportCards } from "@/core/report-cards/publish";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import { PublishedReportCards } from "../../published-report-cards";

export default async function MyReportCardsPage() {
  let cards;
  try {
    cards = await asCurrentActor((ctx) => studentReportCards(ctx, { studentId: ctx.actor.userId }));
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
        <h1>{t("publish.myTitle")}</h1>
        <Link href="/student">{t("studentProfile.myTitle")}</Link>
      </header>
      {cards.length === 0 && (
        <section className="card">
          <p>{t("publish.myEmpty")}</p>
        </section>
      )}
      <PublishedReportCards cards={cards} />
    </main>
  );
}

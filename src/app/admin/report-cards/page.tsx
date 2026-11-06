// The Admin's Report Cards: the school-wide rank switch, and every Class to preview.
import Link from "next/link";
import { listClasses } from "@/core/classes/classes";
import { getRankEnabled } from "@/core/report-cards/rank-setting";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import { RankForm } from "./rank-form";

export default async function ReportCardsPage() {
  let data;
  try {
    data = await asCurrentActor((ctx) => Promise.all([listClasses(ctx), getRankEnabled(ctx)]));
  } catch (err) {
    return (
      <main className="page">
        <p className="error">{t(refusalKey(err))}</p>
      </main>
    );
  }
  const [classes, rankEnabled] = data;

  return (
    <main className="page">
      <header className="topbar">
        <h1>{t("reportCards.title")}</h1>
        <Link href="/admin">{t("nav.dashboard")}</Link>
      </header>
      <section className="card" aria-labelledby="rank">
        <h2 id="rank">{t("reportCards.rankHeading")}</h2>
        <p>{t(rankEnabled ? "reportCards.rankOn" : "reportCards.rankOff")}</p>
        <p className="muted">{t("reportCards.rankHint")}</p>
        <RankForm enabled={rankEnabled} />
      </section>
      <section className="card" aria-labelledby="classes">
        <h2 id="classes">{t("reportCards.classesHeading")}</h2>
        {classes.length === 0 ? (
          <p>{t("reportCards.noClasses")}</p>
        ) : (
          <ul className="list">
            {classes.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/classes/${c.id}/report-cards`}>{c.name}</Link>
                <div className="muted">
                  {t("classes.summary", { grade: c.grade, year: c.academicYear, teacher: c.classTeacher })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

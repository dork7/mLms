// Year end for the Admin: every Academic Year, the Classes still to promote, and the
// form that Closes a year once Promotion is done.
import Link from "next/link";
import { yearEndOverview } from "@/core/year-end/year-end";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import { CloseYearForm } from "./forms";

export default async function YearEndPage() {
  let years;
  try {
    years = await asCurrentActor((ctx) => yearEndOverview(ctx));
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
        <h1>{t("yearEnd.title")}</h1>
        <Link href="/admin">{t("nav.dashboard")}</Link>
      </header>
      {years.length === 0 && (
        <section className="card">
          <p>{t("yearEnd.empty")}</p>
        </section>
      )}
      {years.map((year) => (
        <section className="card" key={year.id} aria-labelledby={`year-${year.id}`}>
          <h2 id={`year-${year.id}`}>{year.name}</h2>
          <p className="muted">
            {t("setup.dateRange", { start: year.startDate, end: year.endDate })}
            {t("common.separator")}
            {year.closed ? t("yearEnd.closed") : t("yearEnd.open")}
          </p>
          {year.classes.length === 0 ? (
            <p>{t("yearEnd.noClasses")}</p>
          ) : (
            <ul className="list">
              {year.classes.map((c) => (
                <li key={c.id} className="list-item">
                  {c.awaitingPromotion > 0 ? (
                    <Link href={`/admin/year-end/classes/${c.id}`}>{t("yearEnd.promoteLink", { name: c.name })}</Link>
                  ) : (
                    <Link href={`/admin/classes/${c.id}`}>{t("yearEnd.viewLink", { name: c.name })}</Link>
                  )}
                  <div className="muted">
                    {c.grade}
                    {t("common.separator")}
                    {c.awaitingPromotion > 0
                      ? t("yearEnd.waiting", { count: c.awaitingPromotion })
                      : t("yearEnd.nothingWaiting")}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {year.canClose && <CloseYearForm academicYearId={year.id} name={year.name} />}
          {!year.closed && !year.canClose && <p className="muted">{t("yearEnd.closeWaiting")}</p>}
        </section>
      ))}
    </main>
  );
}

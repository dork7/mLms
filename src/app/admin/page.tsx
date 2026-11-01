import Link from "next/link";
import { getAdminDashboard } from "@/core/dashboard/admin-dashboard";
import { AccessDenied } from "@/core/errors";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { logout } from "../actions";

export default async function AdminDashboardPage() {
  let dashboard;
  try {
    dashboard = await asCurrentActor((ctx) => getAdminDashboard(ctx));
  } catch (err) {
    if (err instanceof AccessDenied) {
      return (
        <main className="page">
          <p className="error">{t(err.messageKey)}</p>
        </main>
      );
    }
    throw err;
  }
  const waitingTotal = dashboard.reportCardsWaiting.reduce((total, w) => total + w.reportCards, 0);

  return (
    <main className="page">
      <header className="topbar">
        <h1>{t("adminDashboard.title")}</h1>
        <form action={logout}>
          <button className="button-link" type="submit">
            {t("nav.logout")}
          </button>
        </form>
      </header>
      <section className="card">
        <p>{t("adminDashboard.welcome", { name: dashboard.adminName })}</p>
        <p>{t("adminDashboard.today", { date: dashboard.today })}</p>
        <dl className="stats">
          <div>
            <dt>{t("adminDashboard.studentsEnrolled")}</dt>
            <dd>{dashboard.students}</dd>
          </div>
          <div>
            <dt>{t("adminDashboard.activeTeachers")}</dt>
            <dd>{dashboard.teachers}</dd>
          </div>
          <div>
            <dt>
              {dashboard.academicYear
                ? t("adminDashboard.classesIn", { year: dashboard.academicYear })
                : t("adminDashboard.classes")}
            </dt>
            <dd>{dashboard.classes}</dd>
          </div>
          <div>
            <dt>{t("adminDashboard.reportCardsWaiting")}</dt>
            <dd>{waitingTotal}</dd>
          </div>
        </dl>
      </section>
      <section className="card" aria-labelledby="waiting-heading">
        <h2 id="waiting-heading">{t("adminDashboard.reportCardsWaiting")}</h2>
        {dashboard.reportCardsWaiting.length === 0 ? (
          <p>{t("adminDashboard.noneWaiting")}</p>
        ) : (
          <ul className="list">
            {dashboard.reportCardsWaiting.map((w) => (
              <li key={`${w.classId}:${w.termId}`} className="list-item">
                <Link href={`/admin/classes/${w.classId}/report-cards?termId=${w.termId}`}>
                  {t("adminDashboard.waitingLine", { class: w.class, term: w.term, year: w.academicYear })}
                </Link>
                <strong>{w.reportCards}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card">
        <p>
          <Link href="/admin/teachers">{t("nav.teachers")}</Link>
        </p>
        <p>
          <Link href="/admin/classes">{t("nav.classes")}</Link>
        </p>
        <p>
          <Link href="/admin/students">{t("nav.students")}</Link>
        </p>
        <p>
          <Link href="/admin/exams">{t("nav.exams")}</Link>
        </p>
        <p>
          <Link href="/admin/report-cards">{t("nav.reportCards")}</Link>
        </p>
        <p>
          <Link href="/admin/year-end">{t("nav.yearEnd")}</Link>
        </p>
      </section>
      <nav className="card" aria-labelledby="setup-heading">
        <h2 id="setup-heading">{t("adminDashboard.setupHeading")}</h2>
        <ul className="list">
          <li>
            <Link href="/admin/academic-years">{t("setup.academicYears.title")}</Link>
          </li>
          <li>
            <Link href="/admin/grades">{t("setup.grades.title")}</Link>
          </li>
          <li>
            <Link href="/admin/grading-scales">{t("gradingScales.title")}</Link>
          </li>
          <li>
            <Link href="/admin/subjects">{t("setup.subjects.title")}</Link>
          </li>
          <li>
            <Link href="/admin/periods">{t("setup.periods.title")}</Link>
          </li>
          <li>
            <Link href="/admin/rooms">{t("setup.rooms.title")}</Link>
          </li>
        </ul>
      </nav>
    </main>
  );
}

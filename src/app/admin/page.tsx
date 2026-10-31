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

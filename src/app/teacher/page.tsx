import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { logout } from "../actions";

// Placeholder until the Teacher dashboard ticket: somewhere for a Teacher to land.
export default async function TeacherDashboardPage() {
  await asCurrentActor(async () => undefined);
  return (
    <main className="page">
      <header className="topbar">
        <h1>{t("teacherDashboard.title")}</h1>
        <form action={logout}>
          <button className="button-link" type="submit">
            {t("nav.logout")}
          </button>
        </form>
      </header>
      <section className="card">
        <p>{t("teacherDashboard.empty")}</p>
      </section>
    </main>
  );
}

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
        <p>{t("adminDashboard.empty")}</p>
      </section>
    </main>
  );
}

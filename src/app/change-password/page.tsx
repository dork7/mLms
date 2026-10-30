import { redirect } from "next/navigation";
import { t } from "@/i18n";
import { currentSession } from "@/web/as-current-actor";
import { ChangePasswordForm } from "./change-password-form";

export default async function ChangePasswordPage() {
  const session = await currentSession();
  if (!session) redirect("/login");
  return (
    <main className="page">
      <div className="card">
        <h1>{t("changePassword.title")}</h1>
        {session.mustChangePassword && <p>{t("changePassword.firstLogin")}</p>}
        <ChangePasswordForm />
      </div>
    </main>
  );
}

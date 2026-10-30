import { redirect } from "next/navigation";
import { t } from "@/i18n";
import { currentActor } from "@/web/as-current-actor";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if (await currentActor()) redirect("/");
  return (
    <main className="page">
      <div className="card">
        <h1>{t("login.title")}</h1>
        <LoginForm />
      </div>
    </main>
  );
}

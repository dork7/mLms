import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { t } from "@/i18n";
import { currentSession } from "@/web/as-current-actor";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: t("pageTitles.login") };

export default async function LoginPage() {
  if (await currentSession()) redirect("/");
  return (
    <main className="page">
      <div className="card">
        <h1>{t("login.title")}</h1>
        <LoginForm />
      </div>
    </main>
  );
}

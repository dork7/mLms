"use client";
import Link from "next/link";
import { useActionState } from "react";
import { t } from "@/i18n";
import { forgotPassword, type FormState } from "../actions";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState<FormState, FormData>(forgotPassword, {});
  return (
    <main className="page">
      <div className="card">
        <h1>{t("forgotPassword.title")}</h1>
        {state.done ? (
          <p role="status">{t("forgotPassword.sent")}</p>
        ) : (
          <form action={action}>
            <label className="field">
              {t("forgotPassword.email")}
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <button className="button" type="submit" disabled={pending}>
              {t("forgotPassword.submit")}
            </button>
          </form>
        )}
        <p>
          <Link href="/login">{t("forgotPassword.backToLogin")}</Link>
        </p>
      </div>
    </main>
  );
}

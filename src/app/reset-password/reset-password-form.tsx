"use client";
import Link from "next/link";
import { useActionState } from "react";
import { t } from "@/i18n";
import { resetForgottenPassword, type FormState } from "../actions";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(resetForgottenPassword, {});
  if (state.done) {
    return (
      <p role="status">
        {t("resetPassword.done")} <Link href="/login">{t("login.submit")}</Link>
      </p>
    );
  }
  return (
    <form action={action}>
      {state.error && (
        <p className="error" role="alert">
          {t(state.error)}
        </p>
      )}
      <input type="hidden" name="token" value={token} />
      <label className="field">
        {t("changePassword.new")}
        <input name="newPassword" type="password" autoComplete="new-password" minLength={10} required />
      </label>
      <label className="field">
        {t("changePassword.confirm")}
        <input name="confirmPassword" type="password" autoComplete="new-password" minLength={10} required />
      </label>
      <button className="button" type="submit" disabled={pending}>
        {t("resetPassword.submit")}
      </button>
    </form>
  );
}

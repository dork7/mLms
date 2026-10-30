"use client";
import { useActionState } from "react";
import { t } from "@/i18n";
import { changeOwnPassword, type FormState } from "../actions";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(changeOwnPassword, {});
  return (
    <form action={action}>
      {state.error && (
        <p className="error" role="alert">
          {t(state.error)}
        </p>
      )}
      <label className="field">
        {t("changePassword.current")}
        <input name="currentPassword" type="password" autoComplete="current-password" required />
      </label>
      <label className="field">
        {t("changePassword.new")}
        <input name="newPassword" type="password" autoComplete="new-password" minLength={10} required />
      </label>
      <label className="field">
        {t("changePassword.confirm")}
        <input name="confirmPassword" type="password" autoComplete="new-password" minLength={10} required />
      </label>
      <button className="button" type="submit" disabled={pending}>
        {t("changePassword.submit")}
      </button>
    </form>
  );
}

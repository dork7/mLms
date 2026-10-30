"use client";
import { useActionState } from "react";
import { t } from "@/i18n";
import { login, type LoginState } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action}>
      {state.error && (
        <p className="error" role="alert">
          {t(state.error)}
        </p>
      )}
      <label className="field">
        {t("login.email")}
        <input
          name="email"
          type="email"
          autoComplete="username"
          defaultValue={state.email}
          key={state.email}
          required
        />
      </label>
      <label className="field">
        {t("login.password")}
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      <button className="button" type="submit" disabled={pending}>
        {t("login.submit")}
      </button>
    </form>
  );
}

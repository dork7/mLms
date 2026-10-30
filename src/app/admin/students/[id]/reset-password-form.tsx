"use client";
import { useActionState } from "react";
import { t } from "@/i18n";
import { resetPassword, type ResetState } from "../actions";

export function ResetPasswordForm({ studentId, name }: { studentId: string; name: string }) {
  const [state, action, pending] = useActionState<ResetState, FormData>(resetPassword, {});
  return (
    <form action={action}>
      {state.error && (
        <p className="error" role="alert">
          {t(state.error)}
        </p>
      )}
      {state.newPassword && (
        <p role="status">
          {t("students.passwordReset", { name })} <code>{state.newPassword}</code>
        </p>
      )}
      <input type="hidden" name="studentId" value={studentId} />
      <button className="button-link" type="submit" disabled={pending}>
        {t("students.resetPassword")}
      </button>
    </form>
  );
}

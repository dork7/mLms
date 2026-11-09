"use client";
import { useActionState } from "react";
import { useResultFocus } from "@/app/form-kit";
import { t } from "@/i18n";
import { resetPassword, type ResetState } from "../actions";

export function ResetPasswordForm({ studentId, name }: { studentId: string; name: string }) {
  const [state, action, pending] = useActionState<ResetState, FormData>(resetPassword, {});
  const formRef = useResultFocus(state);
  return (
    <form ref={formRef} action={action}>
      {state.error && (
        <p className="error" role="alert" tabIndex={-1}>
          {t(state.error)}
        </p>
      )}
      {state.newPassword && (
        <p role="status" tabIndex={-1}>
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

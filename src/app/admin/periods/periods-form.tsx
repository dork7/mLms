"use client";
import { useActionState, useState } from "react";
import { t } from "@/i18n";
import { type FormState, useResultFocus } from "@/app/form-kit";
import { savePeriodsPerDay } from "../setup-actions";

export function PeriodsForm({ current }: { current: number | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(savePeriodsPerDay, { saved: 0 });
  const formRef = useResultFocus(state);
  const [value, setValue] = useState(current === null ? "" : String(current));

  return (
    <form ref={formRef} action={action}>
      {state.error && (
        <p className="error" role="alert" tabIndex={-1}>
          {t(state.error)}
        </p>
      )}
      {state.saved > 0 && !state.error && <p role="status" tabIndex={-1}>{t("setup.saved")}</p>}
      <label className="field">
        {t("setup.periods.label")}
        <input
          name="periodsPerDay"
          type="number"
          min={1}
          max={20}
          step={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
        />
      </label>
      <button className="button" type="submit" disabled={pending}>
        {t("setup.save")}
      </button>
    </form>
  );
}

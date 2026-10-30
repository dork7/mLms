"use client";
import { useActionState, useState } from "react";
import { t } from "@/i18n";
import { type FormState, savePeriodsPerDay } from "../setup-actions";

export function PeriodsForm({ current }: { current: number | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(savePeriodsPerDay, { saved: 0 });
  const [value, setValue] = useState(current === null ? "" : String(current));

  return (
    <form action={action}>
      {state.error && (
        <p className="error" role="alert">
          {t(state.error)}
        </p>
      )}
      {state.saved > 0 && !state.error && <p role="status">{t("setup.saved")}</p>}
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

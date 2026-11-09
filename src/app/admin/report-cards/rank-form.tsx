"use client";
import { useActionState, useState } from "react";
import { t } from "@/i18n";
import { type FormState, useResultFocus } from "@/app/form-kit";
import { saveRankEnabledAction } from "./actions";

export function RankForm({ enabled }: { enabled: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveRankEnabledAction, { saved: 0 });
  const formRef = useResultFocus(state);
  const [checked, setChecked] = useState(enabled);

  return (
    <form ref={formRef} action={action}>
      {state.error && (
        <p className="error" role="alert" tabIndex={-1}>
          {t(state.error)}
        </p>
      )}
      {state.saved > 0 && !state.error && <p role="status" tabIndex={-1}>{t("setup.saved")}</p>}
      <label className="field">
        <span>
          <input
            name="rankEnabled"
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />{" "}
          {t("reportCards.rankLabel")}
        </span>
      </label>
      <button className="button" type="submit" disabled={pending}>
        {t("setup.save")}
      </button>
    </form>
  );
}

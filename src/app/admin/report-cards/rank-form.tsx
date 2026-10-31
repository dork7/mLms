"use client";
import { useActionState, useState } from "react";
import { t } from "@/i18n";
import type { FormState } from "../setup-actions";
import { saveRankEnabledAction } from "./actions";

export function RankForm({ enabled }: { enabled: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveRankEnabledAction, { saved: 0 });
  const [checked, setChecked] = useState(enabled);

  return (
    <form action={action}>
      {state.error && (
        <p className="error" role="alert">
          {t(state.error)}
        </p>
      )}
      {state.saved > 0 && !state.error && <p role="status">{t("setup.saved")}</p>}
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

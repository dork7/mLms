"use client";
// One Grade's Grading Scale. Inputs are controlled so the entered values survive a
// refusal (React resets uncontrolled forms after an action). The layer checks the bands.
import { useActionState, useState } from "react";
import type { GradingScale } from "@/core/grading/term-grade-rules";
import { t } from "@/i18n";
import type { FormState } from "../setup-actions";
import { saveGradingScaleAction } from "./actions";

type BandRow = { start: string; label: string };

export function GradingScaleForm({
  gradeId,
  grade,
  scale,
}: {
  gradeId: number;
  grade: string;
  scale: GradingScale | null;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveGradingScaleAction, { saved: 0 });
  const [passMark, setPassMark] = useState(scale ? String(scale.passMark) : "");
  const [bands, setBands] = useState<BandRow[]>(
    scale ? scale.bands.map((b) => ({ start: String(b.minPercent), label: b.label })) : [{ start: "0", label: "" }],
  );
  const setBand = (i: number, change: Partial<BandRow>) =>
    setBands((rows) => rows.map((row, j) => (j === i ? { ...row, ...change } : row)));

  return (
    <form action={action}>
      {state.error && (
        <p className="error" role="alert">
          {t(state.error)}
        </p>
      )}
      {!state.error && state.saved > 0 && !pending && (
        <p className="success" role="status">
          {t("setup.saved")}
        </p>
      )}
      {!scale && <p className="muted">{t("gradingScales.notSet")}</p>}
      <input type="hidden" name="gradeId" value={gradeId} />
      <label className="field">
        {t("gradingScales.passMark", { grade })}
        <input
          name="passMark"
          inputMode="decimal"
          autoComplete="off"
          value={passMark}
          onChange={(e) => setPassMark(e.target.value)}
        />
      </label>
      <fieldset className="terms">
        <legend>{t("gradingScales.bands")}</legend>
        {bands.map((row, i) => (
          <div className="row" key={i}>
            <label className="field">
              {t("gradingScales.bandStart", { n: i + 1 })}
              <input
                name="bandStart"
                inputMode="decimal"
                autoComplete="off"
                value={row.start}
                onChange={(e) => setBand(i, { start: e.target.value })}
              />
            </label>
            <label className="field">
              {t("gradingScales.bandLabel", { n: i + 1 })}
              <input
                name="bandLabel"
                autoComplete="off"
                value={row.label}
                onChange={(e) => setBand(i, { label: e.target.value })}
              />
            </label>
            {bands.length > 1 && (
              <button
                className="button-link"
                type="button"
                onClick={() => setBands((rows) => rows.filter((_, j) => j !== i))}
              >
                {t("gradingScales.removeBand", { n: i + 1 })}
              </button>
            )}
          </div>
        ))}
        <button
          className="button-link"
          type="button"
          onClick={() => setBands((rows) => [...rows, { start: "", label: "" }])}
        >
          {t("gradingScales.addBand")}
        </button>
      </fieldset>
      <button className="button" type="submit" disabled={pending}>
        {t("gradingScales.save", { grade })}
      </button>
    </form>
  );
}

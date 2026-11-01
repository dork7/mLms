"use client";
// The year-end forms. Inputs are controlled so the choices survive a refusal.
import { useActionState, useState } from "react";
import { t } from "@/i18n";
import { type FormState, type Option, Refusal, Select } from "@/app/form-kit";
import { closeYear, savePromotion } from "./actions";

const OUTCOMES = ["promoted", "repeating", "leaving"] as const;
type Outcome = (typeof OUTCOMES)[number];
type Choice = { outcome: Outcome; repeatClass: string; lastDay: string };

export function PromotionForm({
  classId,
  students,
  targets,
  noTargets,
  repeatTargets,
  firstDay,
  lastDay,
}: {
  classId: number;
  students: { studentId: string; name: string; studentNumber: string }[];
  targets: Option[];
  /** Why there are no targets, if there are none. */
  noTargets: string | null;
  repeatTargets: Option[];
  firstDay: string;
  lastDay: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(savePromotion, { saved: 0 });
  const [toClass, setToClass] = useState("");
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const choiceOf = (id: string): Choice => choices[id] ?? { outcome: "promoted", repeatClass: "", lastDay: "" };
  const update = (id: string, change: Partial<Choice>) =>
    setChoices((all) => ({ ...all, [id]: { ...choiceOf(id), ...change } }));
  const anyPromoted = students.some((s) => choiceOf(s.studentId).outcome === "promoted");

  return (
    <form action={action}>
      <Refusal error={state.error} />
      <input type="hidden" name="classId" value={classId} />
      {anyPromoted &&
        (targets.length > 0 ? (
          <Select label={t("yearEnd.toClass")} name="toClassId" options={targets} value={toClass} onChange={setToClass} />
        ) : (
          <p className="error">{noTargets}</p>
        ))}
      <p className="muted">{t("yearEnd.lastDayHint")}</p>
      {students.map((s) => {
        const choice = choiceOf(s.studentId);
        return (
          <fieldset className="terms" key={s.studentId}>
            <legend>
              {s.name} <span className="muted">{s.studentNumber}</span>
            </legend>
            <input type="hidden" name="studentId" value={s.studentId} />
            <div className="choice-row">
              {OUTCOMES.map((outcome) => (
                <label key={outcome}>
                  <input
                    type="radio"
                    name={`outcome:${s.studentId}`}
                    value={outcome}
                    checked={choice.outcome === outcome}
                    onChange={() => update(s.studentId, { outcome })}
                  />{" "}
                  {t(`yearEnd.outcome.${outcome}`)}
                </label>
              ))}
            </div>
            {choice.outcome === "repeating" &&
              (repeatTargets.length > 0 ? (
                <Select
                  label={t("yearEnd.repeatClassFor", { name: s.name })}
                  name={`repeatClass:${s.studentId}`}
                  options={repeatTargets}
                  value={choice.repeatClass}
                  onChange={(repeatClass) => update(s.studentId, { repeatClass })}
                />
              ) : (
                <p className="error">{t("yearEnd.needsRepeatTargets")}</p>
              ))}
            {choice.outcome === "leaving" && (
              <label className="field">
                {t("yearEnd.lastDayFor", { name: s.name })}
                <input
                  type="date"
                  name={`lastDay:${s.studentId}`}
                  min={firstDay}
                  max={lastDay}
                  value={choice.lastDay}
                  onChange={(e) => update(s.studentId, { lastDay: e.target.value })}
                />
              </label>
            )}
          </fieldset>
        );
      })}
      <button className="button" type="submit" disabled={pending}>
        {t("yearEnd.promote")}
      </button>
    </form>
  );
}

export function CloseYearForm({ academicYearId, name }: { academicYearId: number; name: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(closeYear, { saved: 0 });
  return (
    <form action={action}>
      <Refusal error={state.error} />
      <input type="hidden" name="academicYearId" value={academicYearId} />
      <p className="muted">{t("yearEnd.closeHint")}</p>
      <p>
        <label>
          <input type="checkbox" required /> {t("yearEnd.closeConfirm", { name })}
        </label>
      </p>
      <button className="button" type="submit" disabled={pending}>
        {t("yearEnd.close", { name })}
      </button>
    </form>
  );
}

"use client";
// The Lesson form, built for a phone: date defaults to today, Periods are large
// tap targets, and only the topic needs typing. Inputs are controlled so values
// survive a refusal; topic and homework clear after a save so the next one is quick.
import { useActionState, useState } from "react";
import { t } from "@/i18n";
import type { FormState } from "../../../admin/setup-actions";
import { logLessonAction } from "./actions";

export function LessonForm({
  classSubjectId,
  today,
  periodsPerDay,
}: {
  classSubjectId: number;
  today: string;
  periodsPerDay: number;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(logLessonAction, { saved: 0 });
  const [date, setDate] = useState(today);
  const [period, setPeriod] = useState("");
  const [topic, setTopic] = useState("");
  const [homework, setHomework] = useState("");
  const [seen, setSeen] = useState(0);
  if (state.saved !== seen) {
    setSeen(state.saved);
    setTopic("");
    setHomework("");
    setPeriod("");
  }

  return (
    <form action={action} className="lesson-form">
      {state.error && (
        <p className="error" role="alert">
          {t(state.error)}
        </p>
      )}
      {state.saved > 0 && !state.error && !pending && (
        <p className="success" role="status">
          {t("lessons.logged")}
        </p>
      )}
      <input type="hidden" name="classSubjectId" value={classSubjectId} />
      <label className="field">
        {t("lessons.date")}
        <input type="date" name="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} required />
      </label>
      <fieldset className="periods">
        <legend>{t("lessons.period")}</legend>
        {Array.from({ length: periodsPerDay }, (_, i) => String(i + 1)).map((n) => (
          <label key={n} className="period-choice">
            <input
              type="radio"
              name="period"
              value={n}
              checked={period === n}
              onChange={() => setPeriod(n)}
              aria-label={t("lessons.periodN", { n })}
              required
            />
            <span aria-hidden="true">{n}</span>
          </label>
        ))}
      </fieldset>
      <label className="field">
        {t("lessons.topic")}
        <input name="topic" value={topic} onChange={(e) => setTopic(e.target.value)} required autoComplete="off" />
      </label>
      <label className="field">
        {t("lessons.homework")}
        <textarea name="homework" rows={2} value={homework} onChange={(e) => setHomework(e.target.value)} />
      </label>
      <button className="button button-block" type="submit" disabled={pending}>
        {t("lessons.log")}
      </button>
    </form>
  );
}

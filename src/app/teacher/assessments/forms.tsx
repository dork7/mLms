"use client";
// Forms for Assessments, built for a phone. Inputs are controlled so values survive
// a refusal (React resets uncontrolled forms after a server action).
import { useActionState, useState } from "react";
import { t } from "@/i18n";
import type { FormState } from "../../admin/setup-actions";
import { createAssessmentAction, saveMarksAction, updateAssessmentAction } from "./actions";

type AssessmentType = "quiz" | "assignment" | "midterm" | "final";
type Status = "score" | "absent" | "exempt";

function Feedback({ state, pending, savedKey }: { state: FormState; pending: boolean; savedKey: "assessments.saved" | "marks.saved" }) {
  if (state.error) {
    return (
      <p className="error" role="alert">
        {t(state.error)}
      </p>
    );
  }
  if (state.saved > 0 && !pending) {
    return (
      <p className="success" role="status">
        {t(savedKey)}
      </p>
    );
  }
  return null;
}

export function CreateAssessmentForm({
  classSubjectId,
  today,
  types,
}: {
  classSubjectId: number;
  today: string;
  types: readonly AssessmentType[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(createAssessmentAction, { saved: 0 });
  const [type, setType] = useState<AssessmentType>(types[0]);
  const [date, setDate] = useState(today);
  const [maxMarks, setMaxMarks] = useState("");
  const [weight, setWeight] = useState("1");

  return (
    <form action={action} className="assessment-form">
      <Feedback state={state} pending={pending} savedKey="assessments.saved" />
      <input type="hidden" name="classSubjectId" value={classSubjectId} />
      <label className="field">
        {t("assessments.type")}
        <select name="type" value={type} onChange={(e) => setType(e.target.value as AssessmentType)}>
          {types.map((x) => (
            <option key={x} value={x}>
              {t(`assessments.types.${x}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        {t("assessments.date")}
        <input type="date" name="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </label>
      <div className="row">
        <label className="field">
          {t("assessments.maxMarks")}
          <input
            name="maxMarks"
            inputMode="decimal"
            value={maxMarks}
            onChange={(e) => setMaxMarks(e.target.value)}
            required
            autoComplete="off"
          />
        </label>
        <label className="field">
          {t("assessments.weight")}
          <input
            name="weight"
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            required
            autoComplete="off"
          />
        </label>
      </div>
      <button className="button button-block" type="submit" disabled={pending}>
        {t("assessments.create")}
      </button>
    </form>
  );
}

export function EditAssessmentForm({
  assessmentId,
  maxMarks: initialMax,
  weight: initialWeight,
}: {
  assessmentId: number;
  maxMarks: number;
  weight: number;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateAssessmentAction, { saved: 0 });
  const [maxMarks, setMaxMarks] = useState(String(initialMax));
  const [weight, setWeight] = useState(String(initialWeight));

  return (
    <form action={action}>
      <Feedback state={state} pending={pending} savedKey="assessments.saved" />
      <p className="muted">{t("assessments.editHint")}</p>
      <input type="hidden" name="assessmentId" value={assessmentId} />
      <div className="row">
        <label className="field">
          {t("assessments.maxMarks")}
          <input name="maxMarks" inputMode="decimal" value={maxMarks} onChange={(e) => setMaxMarks(e.target.value)} />
        </label>
        <label className="field">
          {t("assessments.weight")}
          <input name="weight" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </label>
      </div>
      <button className="button" type="submit" disabled={pending}>
        {t("assessments.save")}
      </button>
    </form>
  );
}

export type GridEntry = {
  studentId: string;
  name: string;
  studentNumber: string;
  mark: number | "absent" | "exempt" | null;
};

/**
 * The marks grid: one row per Student on the roster, with a number pad score input
 * and a status choice. A row set to Absent or Exempt needs no score. One button saves
 * the whole Class in one transaction.
 */
export function MarksGridForm({ assessmentId, maxMarks, rows }: { assessmentId: number; maxMarks: number; rows: GridEntry[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveMarksAction, { saved: 0 });
  const [values, setValues] = useState(() =>
    Object.fromEntries(
      rows.map((r) => [
        r.studentId,
        {
          status: (typeof r.mark === "string" ? r.mark : "score") as Status,
          score: typeof r.mark === "number" ? String(r.mark) : "",
        },
      ]),
    ),
  );
  const set = (id: string, change: Partial<{ status: Status; score: string }>) =>
    setValues((v) => ({ ...v, [id]: { ...v[id], ...change } }));

  return (
    <form action={action}>
      <Feedback state={state} pending={pending} savedKey="marks.saved" />
      <input type="hidden" name="assessmentId" value={assessmentId} />
      <ol className="marks-grid">
        {rows.map((r) => {
          const v = values[r.studentId];
          return (
            <li key={r.studentId} className="mark-row">
              <input type="hidden" name="studentId" value={r.studentId} />
              <span className="mark-student">
                {r.name} <span className="muted">{r.studentNumber}</span>
              </span>
              <input
                className="mark-score"
                name={`score:${r.studentId}`}
                inputMode="decimal"
                autoComplete="off"
                placeholder={`/ ${maxMarks}`}
                aria-label={t("marks.scoreFor", { name: r.name })}
                value={v.status === "score" ? v.score : ""}
                disabled={v.status !== "score"}
                onChange={(e) => set(r.studentId, { score: e.target.value })}
              />
              <select
                className="mark-status"
                name={`status:${r.studentId}`}
                aria-label={t("marks.statusFor", { name: r.name })}
                value={v.status}
                onChange={(e) => set(r.studentId, { status: e.target.value as Status })}
              >
                <option value="score">{t("marks.score")}</option>
                <option value="absent">{t("marks.absent")}</option>
                <option value="exempt">{t("marks.exempt")}</option>
              </select>
            </li>
          );
        })}
      </ol>
      <button className="button button-block" type="submit" disabled={pending}>
        {t("marks.save")}
      </button>
    </form>
  );
}

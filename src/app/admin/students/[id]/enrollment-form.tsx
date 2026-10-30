"use client";
// Enroll a Student in a Class, or move an enrolled Student to another Class, from a
// date. Inputs are controlled so they survive a refusal, and clear after a save.
import { useActionState, useState } from "react";
import { t } from "@/i18n";
import { type Option, Refusal, Select } from "../../classes/forms";
import { type EnrollmentFormState, saveEnrollment } from "../actions";

export function EnrollmentForm({
  studentId,
  mode,
  classes,
}: {
  studentId: string;
  mode: "enroll" | "move";
  classes: Option[];
}) {
  const [state, action, pending] = useActionState<EnrollmentFormState, FormData>(saveEnrollment, { saved: 0 });
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState("");
  const [seen, setSeen] = useState(0);
  if (state.saved !== seen) {
    setSeen(state.saved);
    setClassId("");
    setDate("");
  }

  return (
    <form action={action}>
      <Refusal error={state.error} />
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="mode" value={mode} />
      <div className="row">
        <Select label={t("enrollment.class")} name="classId" options={classes} value={classId} onChange={setClassId} />
        <label className="field">
          {t("enrollment.startDate")}
          <input type="date" name="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
      </div>
      <button className="button" type="submit" disabled={pending}>
        {mode === "move" ? t("enrollment.move") : t("enrollment.enroll")}
      </button>
    </form>
  );
}

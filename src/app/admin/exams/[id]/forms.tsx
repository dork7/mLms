"use client";
// The Admin's forms for one Exam. The reschedule form starts from the Exam's sitting and
// keeps what was typed after a refusal or a save; for a grade-wide Exam it can move every
// Class together. Deleting asks for a tick first.
import { useActionState, useLayoutEffect, useRef, useState } from "react";
import { type FormState, type Option, Refusal, Select, useResultFocus } from "@/app/form-kit";
import type { ExamDetail } from "@/core/exams/exams";
import { t } from "@/i18n";
import { EndsAt } from "../exam-sitting-fields";
import { deleteExamAction, rescheduleExamAction } from "../actions";

export function RescheduleExamForm({ exam, rooms }: { exam: ExamDetail; rooms: Option[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(rescheduleExamAction, { saved: 0 });
  const formRef = useResultFocus(state);
  const [roomId, setRoomId] = useState(String(exam.roomId));
  const [date, setDate] = useState(exam.date);
  const [startTime, setStartTime] = useState(exam.startTime);
  const [duration, setDuration] = useState(String(exam.durationMinutes));
  const [whole, setWhole] = useState(true);
  // React resets a form after its action, which moves this box off its state; put it back,
  // as `Select` does.
  const wholeBox = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    if (wholeBox.current) wholeBox.current.checked = whole;
  });
  const classes = [exam.class, ...exam.gradeWide.map((other) => other.class)].sort().join(", ");

  return (
    <form ref={formRef} action={action}>
      <input type="hidden" name="examId" value={exam.id} />
      <Refusal error={state.error} params={state.errorParams} />
      {state.saved > 0 && !state.error && (
        <p className="success" role="status" tabIndex={-1}>
          {t("exams.rescheduled")}
        </p>
      )}
      <div className="row">
        <div className="field">
          <label htmlFor="exam-date">{t("exams.date")}</label>
          <input
            id="exam-date"
            type="date"
            name="date"
            min={exam.academicYear.startDate}
            max={exam.academicYear.endDate}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            readOnly={exam.hasMarks}
            aria-describedby={exam.hasMarks ? "date-fixed" : undefined}
            required
          />
          {exam.hasMarks && (
            <span id="date-fixed" className="muted">
              {t("exams.dateFixed")}
            </span>
          )}
        </div>
        <label className="field">
          {t("exams.startTime")}
          <input
            type="time"
            name="startTime"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />
        </label>
        <label className="field">
          {t("exams.duration")}
          <input
            type="number"
            name="durationMinutes"
            min="1"
            step="1"
            inputMode="numeric"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            required
          />
        </label>
      </div>
      <EndsAt startTime={startTime} duration={duration} />
      <div className="row">
        <Select label={t("exams.room")} name="roomId" options={rooms} value={roomId} onChange={setRoomId} />
      </div>
      {exam.gradeWide.length > 0 && (
        <p>
          <label>
            <input
              ref={wholeBox}
              type="checkbox"
              name="wholeExam"
              checked={whole}
              onChange={(e) => setWhole(e.target.checked)}
            />{" "}
            {t("exams.moveWhole", { classes })}
          </label>
        </p>
      )}
      <button className="button" type="submit" disabled={pending}>
        {t("exams.reschedule")}
      </button>
    </form>
  );
}

export function DeleteExamForm({ examId, termId }: { examId: number; termId: number | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(deleteExamAction, { saved: 0 });
  const formRef = useResultFocus(state);

  return (
    <form ref={formRef} action={action}>
      <input type="hidden" name="examId" value={examId} />
      {termId !== null && <input type="hidden" name="termId" value={termId} />}
      <Refusal error={state.error} params={state.errorParams} />
      <p className="muted">{t("exams.deleteHint")}</p>
      <p>
        <label>
          <input type="checkbox" required /> {t("exams.deleteConfirm")}
        </label>
      </p>
      <button className="button button-danger" type="submit" disabled={pending}>
        {t("exams.delete")}
      </button>
    </form>
  );
}

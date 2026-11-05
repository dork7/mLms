"use client";
// The Admin's forms for one Exam. The reschedule form starts from the Exam's sitting and
// keeps what was typed after a refusal or a save. Deleting asks for a tick first.
import { useActionState, useState } from "react";
import { type FormState, type Option, Refusal, Select } from "@/app/form-kit";
import type { ExamDetail } from "@/core/exams/exams";
import { t } from "@/i18n";
import { deleteExamAction, rescheduleExamAction } from "../actions";

export function RescheduleExamForm({ exam, rooms }: { exam: ExamDetail; rooms: Option[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(rescheduleExamAction, { saved: 0 });
  const [roomId, setRoomId] = useState(String(exam.roomId));
  const [date, setDate] = useState(exam.date);
  const [startTime, setStartTime] = useState(exam.startTime);
  const [duration, setDuration] = useState(String(exam.durationMinutes));

  return (
    <form action={action}>
      <input type="hidden" name="examId" value={exam.id} />
      <Refusal error={state.error} />
      {state.saved > 0 && !state.error && (
        <p className="success" role="status">
          {t("exams.rescheduled")}
        </p>
      )}
      <div className="row">
        <label className="field">
          {t("exams.date")}
          <input
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
        </label>
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
      {exam.hasMarks && (
        <p id="date-fixed" className="muted">
          {t("exams.dateFixed")}
        </p>
      )}
      <div className="row">
        <Select label={t("exams.room")} name="roomId" options={rooms} value={roomId} onChange={setRoomId} />
      </div>
      <button className="button" type="submit" disabled={pending}>
        {t("exams.reschedule")}
      </button>
    </form>
  );
}

export function DeleteExamForm({ examId, termId }: { examId: number; termId: number | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(deleteExamAction, { saved: 0 });

  return (
    <form action={action}>
      <input type="hidden" name="examId" value={examId} />
      {termId !== null && <input type="hidden" name="termId" value={termId} />}
      <Refusal error={state.error} />
      <p className="muted">{t("exams.deleteHint")}</p>
      <p>
        <label>
          <input type="checkbox" required /> {t("exams.deleteConfirm")}
        </label>
      </p>
      <button className="button" type="submit" disabled={pending}>
        {t("exams.delete")}
      </button>
    </form>
  );
}

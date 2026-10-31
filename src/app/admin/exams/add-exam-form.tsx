"use client";
// The Admin's form for one Exam. Inputs are controlled so a refused Exam keeps what was
// typed. A save clears only the Class Subject and Room, which keeps the date, time and
// marks ready for the next Class of a grade-wide Exam.
import { useActionState, useState } from "react";
import { t } from "@/i18n";
import { type Option, Refusal, Select, useOnSaved } from "../classes/forms";
import type { FormState } from "../setup-actions";
import { addExamAction } from "./actions";

export function AddExamForm({
  classSubjects,
  rooms,
  types,
  firstDay,
  lastDay,
}: {
  classSubjects: Option[];
  rooms: Option[];
  types: Option[];
  /** The Term's dates: the form adds to the Term on screen. */
  firstDay: string;
  lastDay: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(addExamAction, { saved: 0 });
  const [classSubjectId, setClassSubjectId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [type, setType] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [duration, setDuration] = useState("");
  const [maxMarks, setMaxMarks] = useState("");
  const [weight, setWeight] = useState("");
  useOnSaved(state, () => {
    setClassSubjectId("");
    setRoomId("");
  });

  return (
    <form action={action}>
      <Refusal error={state.error} />
      {state.saved > 0 && !state.error && (
        <p className="success" role="status">
          {t("exams.added")}
        </p>
      )}
      <div className="row">
        <Select
          label={t("exams.classSubject")}
          name="classSubjectId"
          options={classSubjects}
          value={classSubjectId}
          onChange={setClassSubjectId}
        />
        <Select label={t("exams.room")} name="roomId" options={rooms} value={roomId} onChange={setRoomId} />
      </div>
      <div className="row">
        <label className="field">
          {t("exams.date")}
          <input
            type="date"
            name="date"
            min={firstDay}
            max={lastDay}
            value={date}
            onChange={(e) => setDate(e.target.value)}
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
      <div className="row">
        <Select label={t("exams.type")} name="type" options={types} value={type} onChange={setType} />
        <label className="field">
          {t("exams.maxMarks")}
          <input
            type="number"
            name="maxMarks"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            value={maxMarks}
            onChange={(e) => setMaxMarks(e.target.value)}
            required
          />
        </label>
        <label className="field">
          {t("exams.weight")}
          <input
            type="number"
            name="weight"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            required
          />
        </label>
      </div>
      <button className="button" type="submit" disabled={pending}>
        {t("exams.add")}
      </button>
    </form>
  );
}

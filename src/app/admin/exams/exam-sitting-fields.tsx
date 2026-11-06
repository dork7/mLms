"use client";
// When an Exam is sat and what it's worth, shared by the single and grade-wide forms. The
// inputs are controlled and never cleared, so a refusal keeps what was typed and a save
// keeps the details ready for the next Exam.
import { useState } from "react";
import { type Option, Select } from "@/app/form-kit";
import { t } from "@/i18n";

export function ExamSittingFields({
  types,
  firstDay,
  lastDay,
}: {
  types: Option[];
  /** The Term's dates: the form adds to the Term on screen. */
  firstDay: string;
  lastDay: string;
}) {
  const [type, setType] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [duration, setDuration] = useState("");
  const [maxMarks, setMaxMarks] = useState("");
  const [weight, setWeight] = useState("");

  return (
    <>
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
    </>
  );
}

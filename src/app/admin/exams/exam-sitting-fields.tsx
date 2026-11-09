"use client";
// When an Exam is sat and what it's worth, shared by the single and grade-wide forms. The
// inputs are controlled and never cleared, so a refusal keeps what was typed and a save
// keeps the details ready for the next Exam. `EndsAt` shows when a sitting would end.
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
      <EndsAt startTime={startTime} duration={duration} />
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

/** When a sitting typed so far would end, worked out as the Admin types; nothing until both are filled in. */
export function EndsAt({ startTime, duration }: { startTime: string; duration: string }) {
  const match = /^(\d{2}):(\d{2})$/.exec(startTime);
  const minutes = Number(duration);
  if (!match || !Number.isInteger(minutes) || minutes <= 0) return null;
  const end = Number(match[1]) * 60 + Number(match[2]) + minutes;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <p className="muted" aria-live="polite">
      {end > 24 * 60
        ? t("exams.endsAfterMidnight")
        : t("exams.endsAt", { end: `${pad(Math.floor(end / 60))}:${pad(end % 60)}` })}
    </p>
  );
}

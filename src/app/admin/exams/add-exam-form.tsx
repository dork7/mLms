"use client";
// The Admin's form for one Exam. Inputs are controlled so a refused Exam keeps what was
// typed. A save clears only the Class Subject and Room.
import { useActionState, useState } from "react";
import { type FormState, type Option, Refusal, Select, useOnSaved } from "@/app/form-kit";
import { t } from "@/i18n";
import { addExamAction } from "./actions";
import { ExamSittingFields } from "./exam-sitting-fields";

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
      <ExamSittingFields types={types} firstDay={firstDay} lastDay={lastDay} />
      <button className="button" type="submit" disabled={pending}>
        {t("exams.add")}
      </button>
    </form>
  );
}

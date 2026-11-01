"use client";
// The Admin's form for a grade-wide Exam: one Subject across a Grade's Classes, with a Room
// for each Class. Choosing the Grade and Subject shows which Classes sit it. A save clears
// the choice and Rooms and keeps the time and marks.
import { Fragment, useActionState, useState } from "react";
import { type FormState, type Option, Refusal, Select, useOnSaved } from "@/app/form-kit";
import type { GradeWideExamChoice } from "@/core/exams/exams";
import { t } from "@/i18n";
import { addGradeWideExamAction } from "./actions";
import { ExamSittingFields } from "./exam-sitting-fields";

export function AddGradeWideExamForm({
  academicYearId,
  choices,
  rooms,
  types,
  firstDay,
  lastDay,
}: {
  academicYearId: number;
  choices: GradeWideExamChoice[];
  rooms: Option[];
  types: Option[];
  /** The Term's dates: the form adds to the Term on screen. */
  firstDay: string;
  lastDay: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(addGradeWideExamAction, { saved: 0 });
  const [chosen, setChosen] = useState("");
  const [roomOf, setRoomOf] = useState<Record<number, string>>({});
  useOnSaved(state, () => {
    setChosen("");
    setRoomOf({});
  });
  const keyOf = (c: GradeWideExamChoice) => `${c.gradeId}:${c.subjectId}`;
  const choice = choices.find((c) => keyOf(c) === chosen);

  return (
    <form action={action}>
      <Refusal error={state.error} />
      {state.saved > 0 && !state.error && (
        <p className="success" role="status">
          {t("exams.gradeWideAdded")}
        </p>
      )}
      <input type="hidden" name="academicYearId" value={academicYearId} />
      <Select
        label={t("exams.gradeAndSubject")}
        name="gradeAndSubject"
        options={choices.map((c) => ({
          id: keyOf(c),
          name: t("exams.gradeAndSubjectOption", { grade: c.grade, subject: c.subject }),
        }))}
        value={chosen}
        onChange={setChosen}
      />
      {choice && (
        <div className="row">
          {choice.classSubjects.map((cs) => (
            <Fragment key={cs.id}>
              <input type="hidden" name="classSubjectId" value={cs.id} />
              <Select
                label={t("exams.roomFor", { class: cs.class })}
                name={`room:${cs.id}`}
                options={rooms}
                value={roomOf[cs.id] ?? ""}
                onChange={(roomId) => setRoomOf((all) => ({ ...all, [cs.id]: roomId }))}
              />
            </Fragment>
          ))}
        </div>
      )}
      <ExamSittingFields types={types} firstDay={firstDay} lastDay={lastDay} />
      <button className="button" type="submit" disabled={pending}>
        {t("exams.addGradeWide")}
      </button>
    </form>
  );
}

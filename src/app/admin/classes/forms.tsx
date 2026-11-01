"use client";
// The Admin's Class and Class Subject forms. Selects are controlled so the
// choices survive a refusal; a create form clears itself after a save.
import { useActionState, useState } from "react";
import { type FormState, type Option, Refusal, Select, useOnSaved } from "@/app/form-kit";
import { t } from "@/i18n";
import { addClass, addClassSubject, reassignTeacher } from "./actions";

export function AddClassForm({
  academicYears,
  grades,
  teachers,
}: {
  academicYears: Option[];
  grades: Option[];
  teachers: Option[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(addClass, { saved: 0 });
  const [academicYearId, setAcademicYearId] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [name, setName] = useState("");
  const [classTeacherId, setClassTeacherId] = useState("");
  useOnSaved(state, () => {
    setName("");
    setClassTeacherId("");
  });

  return (
    <form action={action}>
      <Refusal error={state.error} />
      <div className="row">
        <Select
          label={t("classes.academicYear")}
          name="academicYearId"
          options={academicYears}
          value={academicYearId}
          onChange={setAcademicYearId}
        />
        <Select label={t("classes.grade")} name="gradeId" options={grades} value={gradeId} onChange={setGradeId} />
      </div>
      <div className="row">
        <label className="field">
          {t("classes.name")}
          <input name="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <Select
          label={t("classes.classTeacher")}
          name="classTeacherId"
          options={teachers}
          value={classTeacherId}
          onChange={setClassTeacherId}
        />
      </div>
      <button className="button" type="submit" disabled={pending}>
        {t("classes.add")}
      </button>
    </form>
  );
}

export function AddClassSubjectForm({
  classId,
  subjects,
  teachers,
}: {
  classId: number;
  subjects: Option[];
  teachers: Option[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(addClassSubject, { saved: 0 });
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  useOnSaved(state, () => {
    setSubjectId("");
    setTeacherId("");
  });

  return (
    <form action={action}>
      <Refusal error={state.error} />
      <input type="hidden" name="classId" value={classId} />
      <div className="row">
        <Select label={t("classes.subject")} name="subjectId" options={subjects} value={subjectId} onChange={setSubjectId} />
        <Select
          label={t("classes.subjectTeacher")}
          name="teacherId"
          options={teachers}
          value={teacherId}
          onChange={setTeacherId}
        />
      </div>
      <button className="button" type="submit" disabled={pending}>
        {t("classes.addClassSubject")}
      </button>
    </form>
  );
}

export function ReassignTeacherForm({
  classId,
  classSubjectId,
  subject,
  teacherId: current,
  teachers,
}: {
  classId: number;
  classSubjectId: number;
  subject: string;
  teacherId: string;
  teachers: Option[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(reassignTeacher, { saved: 0 });
  const [teacherId, setTeacherId] = useState(current);

  return (
    <form action={action} className="inline-form">
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="classSubjectId" value={classSubjectId} />
      <Select
        label={t("classes.subjectTeacherOf", { subject })}
        name="teacherId"
        options={teachers}
        value={teacherId}
        onChange={setTeacherId}
      />
      <button className="button" type="submit" disabled={pending || teacherId === current}>
        {t("classes.reassign")}
      </button>
      <Refusal error={state.error} />
    </form>
  );
}

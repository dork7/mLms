"use client";
import { useActionState } from "react";
import { t, type MessageKey } from "@/i18n";
import { addStudent, type Entered, type RegisterStudentState } from "./actions";

const FIELDS: { name: keyof Entered; label: MessageKey; type: string; required: boolean }[] = [
  { name: "name", label: "students.name", type: "text", required: true },
  { name: "studentNumber", label: "students.studentNumber", type: "text", required: true },
  { name: "dateOfBirth", label: "students.dateOfBirth", type: "date", required: true },
  { name: "nationalId", label: "students.nationalId", type: "text", required: true },
  { name: "guardianContact", label: "students.guardianContact", type: "text", required: true },
  { name: "email", label: "students.email", type: "email", required: false },
  { name: "admissionDate", label: "students.admissionDate", type: "date", required: true },
];

export function RegisterStudentForm() {
  const [state, action, pending] = useActionState<RegisterStudentState, FormData>(addStudent, {});
  const entered = state.entered;
  return (
    <form action={action} key={state.registered ? state.registered.initialPassword : "form"}>
      {state.error && (
        <p className="error" role="alert">
          {t(state.error)}
        </p>
      )}
      {state.registered && (
        <p role="status">
          {t("students.registered", {
            name: state.registered.name,
            studentNumber: state.registered.studentNumber,
          })}{" "}
          <code>{state.registered.initialPassword}</code>
        </p>
      )}
      {FIELDS.map((field) => (
        <label className="field" key={field.name}>
          {t(field.label)}
          <input
            name={field.name}
            type={field.type}
            autoComplete="off"
            defaultValue={entered?.[field.name]}
            required={field.required}
          />
        </label>
      ))}
      <label className="field">
        {t("students.photo")}
        <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" />
      </label>
      <button className="button" type="submit" disabled={pending}>
        {t("students.register")}
      </button>
    </form>
  );
}

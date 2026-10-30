"use client";
import { useActionState } from "react";
import { t } from "@/i18n";
import { addTeacher, type CreateTeacherState } from "./actions";

export function AddTeacherForm() {
  const [state, action, pending] = useActionState<CreateTeacherState, FormData>(addTeacher, {});
  const entered = state.entered;
  return (
    <form action={action} key={state.created ? state.created.initialPassword : "form"}>
      {state.error && (
        <p className="error" role="alert">
          {t(state.error)}
        </p>
      )}
      {state.created && (
        <p role="status">
          {t("teachers.created", { name: state.created.name })} <code>{state.created.initialPassword}</code>
        </p>
      )}
      <label className="field">
        {t("teachers.name")}
        <input name="name" defaultValue={entered?.name} required />
      </label>
      <label className="field">
        {t("teachers.email")}
        <input name="email" type="email" autoComplete="off" defaultValue={entered?.email} />
      </label>
      <label className="field">
        {t("teachers.phone")}
        <input name="phone" type="tel" autoComplete="off" defaultValue={entered?.phone} />
      </label>
      <button className="button" type="submit" disabled={pending}>
        {t("teachers.add")}
      </button>
    </form>
  );
}

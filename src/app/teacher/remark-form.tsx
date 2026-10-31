"use client";
// One Student's remark. It keeps what was typed through a refusal, and the page keys it
// by Term so another Term's remark doesn't inherit this one's text.
import { useActionState, useState } from "react";
import { t } from "@/i18n";
import type { FormState } from "../admin/setup-actions";
import { Refusal } from "../admin/classes/forms";

export function RemarkForm({
  action: save,
  label,
  fields,
  remark,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  label: string;
  /** The ids the action needs, sent as hidden fields. */
  fields: Record<string, string | number>;
  remark: string | null;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(save, { saved: 0 });
  const [value, setValue] = useState(remark ?? "");

  return (
    <form action={action}>
      <Refusal error={state.error} />
      {state.saved > 0 && !state.error && (
        <p className="success" role="status">
          {t("remarks.saved")}
        </p>
      )}
      {Object.entries(fields).map(([name, fieldValue]) => (
        <input key={name} type="hidden" name={name} value={fieldValue} />
      ))}
      <label className="field">
        {label}
        <textarea name="remark" rows={3} value={value} onChange={(e) => setValue(e.target.value)} />
      </label>
      <button className="button" type="submit" disabled={pending}>
        {t("remarks.save")}
      </button>
    </form>
  );
}

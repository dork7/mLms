"use client";
// One Grade, Subject or Room: an edit form when `item` is given, else a create form.
import { useActionState, useState } from "react";
import type { Named } from "@/core/school/catalogue";
import { type MessageKey, t } from "@/i18n";
import type { FormState } from "@/app/form-kit";
import { type NamedKind, saveNamed } from "./setup-actions";

export function NamedForm({ kind, item, label }: { kind: NamedKind; item?: Named; label: MessageKey }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveNamed.bind(null, kind), {
    saved: 0,
  });
  const [name, setName] = useState(item?.name ?? "");
  const [seen, setSeen] = useState(0);
  if (state.saved !== seen) {
    setSeen(state.saved);
    if (!item) setName("");
  }

  return (
    <form action={action} className="inline-form">
      {item && <input type="hidden" name="id" value={item.id} />}
      <label className="field">
        {t(label)}
        <input name="name" value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <button className="button" type="submit" disabled={pending}>
        {t(item ? "setup.save" : "setup.add")}
      </button>
      {state.error && (
        <p className="error" role="alert">
          {t(state.error)}
        </p>
      )}
    </form>
  );
}

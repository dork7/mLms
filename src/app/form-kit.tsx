"use client";
// What the app's forms share: the state a form action returns, a controlled select that
// survives a refusal, how a refusal reads, and clearing a create form after a save.
import { useLayoutEffect, useRef, useState } from "react";
import { type MessageKey, t } from "@/i18n";

/** `saved` counts successful saves so a create form knows when to clear itself. */
export type FormState = { error?: MessageKey; saved: number };

export type Option = { id: number | string; name: string };

export function Select({
  label,
  name,
  options,
  value,
  onChange,
}: {
  label: string;
  name: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
}) {
  // React resets a form after its action runs. That leaves an input's value alone but moves a
  // select off its value until something re-renders it with a change, so a refused form
  // would show "Choose" and `required` would then silently block the next submit.
  const select = useRef<HTMLSelectElement>(null);
  useLayoutEffect(() => {
    if (select.current) select.current.value = value;
  });

  return (
    <label className="field">
      {label}
      <select ref={select} name={name} value={value} onChange={(e) => onChange(e.target.value)} required>
        <option value="" disabled>
          {t("classes.choose")}
        </option>
        {options.map((o) => (
          <option key={o.id} value={String(o.id)}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Refusal({ error }: { error?: MessageKey }) {
  if (!error) return null;
  return (
    <p className="error" role="alert">
      {t(error)}
    </p>
  );
}

/** Calls `reset` once each time `state.saved` goes up. */
export function useOnSaved(state: FormState, reset: () => void) {
  const [seen, setSeen] = useState(0);
  if (state.saved !== seen) {
    setSeen(state.saved);
    reset();
  }
}

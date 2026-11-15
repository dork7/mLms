"use client";
// What the app's forms share: the state a form action returns, a controlled select that
// survives a refusal, how a refusal reads, moving focus to a form's message after a submit,
// and clearing a create form after a save.
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { type MessageKey, t } from "@/i18n";

/**
 * `saved` counts successful saves so a create form knows when to clear itself. A refusal
 * that says more (which Exam clashes, say) carries `errorParams` for its message.
 */
export type FormState = { error?: MessageKey; errorParams?: Record<string, string | number>; saved: number };

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

export function Refusal({ error, params }: { error?: MessageKey; params?: Record<string, string | number> }) {
  if (!error) return null;
  return (
    <p className="error" role="alert" tabIndex={-1}>
      {params ? withDetailsKeptTogether(error, params) : t(error)}
    </p>
  );
}

const MARK = "\u0000";
/** Longer than this, a detail could be wider than a phone's line, so it may wrap. */
const KEEP_TOGETHER_MAX = 20;

/**
 * The message with each short detail (a Class, Room or time) in a `.keep-together` span,
 * so a line never breaks inside one ("10-" then "A"). The text is the same as `t` gives.
 */
function withDetailsKeptTogether(key: MessageKey, params: Record<string, string | number>): ReactNode[] {
  const marked = Object.fromEntries(Object.keys(params).map((name) => [name, `${MARK}${name}${MARK}`]));
  return t(key, marked)
    .split(MARK)
    .map((part, i) => {
      if (i % 2 === 0) return part;
      const detail = String(params[part]);
      return detail.length > KEEP_TOGETHER_MAX ? (
        detail
      ) : (
        <span key={i} className="keep-together">
          {detail}
        </span>
      );
    });
}

/**
 * After each submit, moves focus to the form's message (its refusal or confirmation), so
 * the message is on screen and read out, and Tab carries on from there. Returns the ref for
 * the <form>. A message shown in place of the form is looked for in <main>. Messages need
 * `tabIndex={-1}` to take focus.
 */
export function useResultFocus(state: unknown) {
  const form = useRef<HTMLFormElement>(null);
  const initial = useRef(state);
  useEffect(() => {
    if (state === initial.current) return;
    const scope: ParentNode | null = form.current?.isConnected ? form.current : document.querySelector("main");
    scope?.querySelector<HTMLElement>('[role="alert"], [role="status"]')?.focus();
  }, [state]);
  return form;
}

/**
 * A message about what just happened on another page (a decision, a deletion), shown after
 * a redirect. It takes focus when it appears, so it's seen and read out first. `dropParam`
 * names the query parameter that asked for it, which is then taken out of the address, so a
 * later save on the same page doesn't show the message again.
 */
export function Flash({ kind, dropParam, children }: { kind: "success" | "error"; dropParam?: string; children: ReactNode }) {
  const message = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    message.current?.focus();
    if (dropParam) {
      const url = new URL(window.location.href);
      url.searchParams.delete(dropParam);
      window.history.replaceState(null, "", url);
    }
  }, [dropParam]);
  return (
    <p ref={message} className={kind} role={kind === "error" ? "alert" : "status"} tabIndex={-1}>
      {children}
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

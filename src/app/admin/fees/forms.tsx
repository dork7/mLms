"use client";
// The Admin's Fee forms. Inputs are controlled so values survive a refusal; a create
// form clears itself after a save.
import { useActionState, useState } from "react";
import { type FormState, type Option, Refusal, Select, useOnSaved } from "@/app/form-kit";
import { t } from "@/i18n";
import {
  type ApplyState,
  applyFee,
  defineFee,
  logPayment,
  type RemindState,
  saveReminderSettings,
  sendRemindersNow,
} from "./actions";

export function DefineFeeForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(defineFee, { saved: 0 });
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  useOnSaved(state, () => {
    setName("");
    setAmount("");
    setDueDate("");
  });

  return (
    <form action={action}>
      <Refusal error={state.error} />
      <label className="field">
        {t("fees.name")}
        <input name="name" value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <div className="row">
        <label className="field">
          {t("fees.amount")}
          <input name="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </label>
        <label className="field">
          {t("fees.dueDate")}
          <input name="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
        </label>
      </div>
      <button className="button" type="submit" disabled={pending}>
        {t("fees.define")}
      </button>
    </form>
  );
}

function Assigned({ state }: { state: ApplyState }) {
  if (state.assigned === undefined) return null;
  return (
    <p className="success" role="status">
      {t("fees.assigned", { count: state.assigned })}
    </p>
  );
}

export function ApplyToGradeForm({ feeId, grades }: { feeId: number; grades: Option[] }) {
  const [state, action, pending] = useActionState<ApplyState, FormData>(applyFee, { saved: 0 });
  const [gradeId, setGradeId] = useState("");

  return (
    <form action={action}>
      <Refusal error={state.error} />
      <Assigned state={state} />
      <input type="hidden" name="feeId" value={feeId} />
      <p className="muted">{t("fees.applyToGradeHint")}</p>
      <div className="inline-form">
        <Select label={t("fees.grade")} name="gradeId" options={grades} value={gradeId} onChange={setGradeId} />
        <button className="button" type="submit" disabled={pending}>
          {t("fees.apply")}
        </button>
      </div>
    </form>
  );
}

export function ApplyToStudentsForm({ feeId, students }: { feeId: number; students: Option[] }) {
  const [state, action, pending] = useActionState<ApplyState, FormData>(applyFee, { saved: 0 });

  return (
    <form action={action}>
      <Refusal error={state.error} />
      <Assigned state={state} />
      <input type="hidden" name="feeId" value={feeId} />
      {students.length === 0 ? (
        <p>{t("fees.everyoneOwes")}</p>
      ) : (
        <>
          <fieldset className="terms">
            <legend>{t("fees.students")}</legend>
            <ul className="list">
              {students.map((s) => (
                <li key={s.id}>
                  <label>
                    <input type="checkbox" name="studentId" value={String(s.id)} /> {s.name}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
          <button className="button" type="submit" disabled={pending}>
            {t("fees.apply")}
          </button>
        </>
      )}
    </form>
  );
}

export function PaymentRecordForm({ feeAssignmentId, methods }: { feeAssignmentId: number; methods: Option[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(logPayment, { saved: 0 });
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  useOnSaved(state, () => {
    setAmount("");
    setDate("");
    setMethod("");
    setReference("");
  });

  return (
    <form action={action}>
      <Refusal error={state.error} />
      <input type="hidden" name="feeAssignmentId" value={feeAssignmentId} />
      <div className="row">
        <label className="field">
          {t("fees.amount")}
          <input name="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </label>
        <label className="field">
          {t("fees.paymentDate")}
          <input name="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
      </div>
      <div className="row">
        <Select
          label={t("fees.method")}
          name="method"
          options={methods}
          value={method}
          onChange={setMethod}
        />
        <label className="field">
          {t("fees.reference")}
          <input name="reference" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={200} />
        </label>
      </div>
      <button className="button" type="submit" disabled={pending}>
        {t("fees.logPayment")}
      </button>
    </form>
  );
}

export function FeeReminderSettingsForm({ leadDays, intervalDays }: { leadDays: number; intervalDays: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveReminderSettings, { saved: 0 });
  const [lead, setLead] = useState(String(leadDays));
  const [interval, setIntervalDays] = useState(String(intervalDays));

  return (
    <form action={action}>
      <Refusal error={state.error} />
      {state.saved > 0 && !state.error && (
        <p className="success" role="status">
          {t("feeReminders.saved")}
        </p>
      )}
      <div className="row">
        <label className="field">
          {t("feeReminders.leadDays")}
          <input name="leadDays" type="number" min={1} max={365} step={1} value={lead} onChange={(e) => setLead(e.target.value)} required />
        </label>
        <label className="field">
          {t("feeReminders.intervalDays")}
          <input
            name="intervalDays"
            type="number"
            min={1}
            max={365}
            step={1}
            value={interval}
            onChange={(e) => setIntervalDays(e.target.value)}
            required
          />
        </label>
      </div>
      <button className="button" type="submit" disabled={pending}>
        {t("feeReminders.save")}
      </button>
    </form>
  );
}

export function SendRemindersNowForm({ feeId }: { feeId: number }) {
  const [state, action, pending] = useActionState<RemindState, FormData>(sendRemindersNow, { saved: 0 });
  const result = state.result;

  return (
    <form action={action}>
      <Refusal error={state.error} />
      {result && !state.error && (
        <p className="success" role="status">
          {t("feeReminders.sendNowResult", {
            sent: result.sent,
            noEmail: result.noEmail,
            alreadySentToday: result.alreadySentToday,
          })}
          {result.failed > 0 && ` ${t("feeReminders.sendNowFailed", { failed: result.failed })}`}
        </p>
      )}
      <p className="muted">{t("feeReminders.sendNowHint")}</p>
      <input type="hidden" name="feeId" value={feeId} />
      <button className="button" type="submit" disabled={pending}>
        {t("feeReminders.sendNow")}
      </button>
    </form>
  );
}

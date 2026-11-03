"use client";
// The Leave Request form. Dates and reason are controlled so they survive a refusal; the
// file input can't be, so a refused request needs its file chosen again. A file over the
// limit is refused here before it is sent, since a body over the server's limit would fail
// without a translated message.
import { useActionState, useState } from "react";
import { type FormState, Refusal, useOnSaved } from "@/app/form-kit";
import { MAX_ATTACHMENT_BYTES } from "@/core/leave/attachment";
import { type MessageKey, t } from "@/i18n";
import { submitLeaveAction } from "./actions";

export function LeaveRequestForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(submitLeaveAction, { saved: 0 });
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [fileError, setFileError] = useState<MessageKey>();
  useOnSaved(state, () => {
    setStartDate("");
    setEndDate("");
    setReason("");
  });

  return (
    <form action={action}>
      <Refusal error={fileError ?? state.error} />
      {state.saved > 0 && !state.error && !fileError && !pending && (
        <p className="success" role="status">
          {t("leave.submitted")}
        </p>
      )}
      <div className="row">
        <label className="field">
          {t("leave.startDate")}
          <input type="date" name="startDate" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </label>
        <label className="field">
          {t("leave.endDate")}
          <input
            type="date"
            name="endDate"
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </label>
      </div>
      <label className="field">
        {t("leave.reason")}
        <textarea name="reason" rows={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} required />
      </label>
      <label className="field">
        {t("leave.attachment")}
        <input
          type="file"
          name="attachment"
          accept="application/pdf,image/jpeg,image/png"
          onChange={(e) => {
            const tooBig = (e.target.files?.[0]?.size ?? 0) > MAX_ATTACHMENT_BYTES;
            setFileError(tooBig ? "errors.leaveAttachmentSize" : undefined);
            if (tooBig) e.target.value = "";
          }}
        />
        <span className="muted">{t("leave.attachmentHint")}</span>
      </label>
      <button className="button button-block" type="submit" disabled={pending}>
        {t("leave.submit")}
      </button>
    </form>
  );
}

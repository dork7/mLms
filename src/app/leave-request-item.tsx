// One Leave Request as it reads on any page: dates, reason, attachment, status and decision.
// Shared by the requester's own list and the deciders' lists. Server components only.
import type { ReactNode } from "react";
import { dateText } from "@/app/date-text";
import type { LeaveRequestRow } from "@/core/leave/leave-requests";
import { t } from "@/i18n";
import { whenText } from "./when-text";

export function LeaveRequestItem({
  request,
  showRequester,
  requesterClass,
  children,
}: {
  request: LeaveRequestRow;
  showRequester: boolean;
  /** A Student requester's Class today, for the Class Teacher's list. */
  requesterClass?: string;
  /** Actions for whoever may decide it. */
  children?: ReactNode;
}) {
  const { startDate, endDate } = request;
  const status = t(`leave.status.${request.status}`);
  return (
    <li className="leave-request" aria-label={leaveLabel(request, showRequester)}>
      <div>
        {showRequester && <strong>{request.requester}</strong>}
        {requesterClass && <div className="muted">{requesterClass}</div>}
        <div>
          {startDate === endDate
            ? t("leave.oneDay", { date: dateText(startDate) })
            : t("leave.dates", { start: dateText(startDate), end: dateText(endDate) })}
        </div>
        <p className="remark">{request.reason}</p>
        {request.attachment && (
          <p>
            <a href={`/leave-requests/${request.id}/attachment`} download>
              {t("leave.download", { name: request.attachment.fileName })}
            </a>
          </p>
        )}
        <div className="muted">{t("leave.submittedAt", { when: whenText(request.submittedAt) })}</div>
        <div className={`leave-status leave-status-${request.status}`}>
          {request.decidedBy && request.decidedAt
            ? t("leave.decidedLine", { status, name: request.decidedBy, when: whenText(request.decidedAt) })
            : status}
        </div>
      </div>
      {children}
    </li>
  );
}

function leaveLabel(request: LeaveRequestRow, showRequester: boolean): string {
  const dates =
    request.startDate === request.endDate
      ? dateText(request.startDate)
      : t("leave.dates", { start: dateText(request.startDate), end: dateText(request.endDate) });
  return showRequester ? `${request.requester}${t("common.labelSeparator")}${dates}` : dates;
}

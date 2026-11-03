// A decider's list of Leave Requests: those waiting for a decision with Approve and Reject,
// then those decided with "Change to …". Used by the Admin's page (Students and Teachers)
// and the Class Teacher's page. Server components only.
import type { LeaveRequestQueue, LeaveRequestRow } from "@/core/leave/leave-requests";
import { t } from "@/i18n";
import { LeaveRequestItem } from "./leave-request-item";

type Row = LeaveRequestRow & { class?: string; canDecide?: boolean };

export function LeaveQueue({
  queue,
  decide,
  idPrefix,
  forStudents,
}: {
  queue: LeaveRequestQueue<Row>;
  /** The page's server action, which calls `decideFromForm`. */
  decide: (form: FormData) => Promise<void>;
  /** Keeps heading ids unique when a page shows two queues. */
  idPrefix: string;
  /** Students' requests change Marks, so the outcome reports them. */
  forStudents: boolean;
}) {
  const button = (request: Row, decision: "approved" | "rejected", label: string, quiet = false) => (
    <form action={decide}>
      <input type="hidden" name="leaveRequestId" value={request.id} />
      <input type="hidden" name="decision" value={decision} />
      {forStudents && <input type="hidden" name="student" value="1" />}
      <button className={quiet ? "button-link" : "button"} type="submit">
        {label}
      </button>
    </form>
  );

  return (
    <>
      <section className="card" aria-labelledby={`${idPrefix}-pending`}>
        <h2 id={`${idPrefix}-pending`}>{t("leave.pending")}</h2>
        {queue.pending.length === 0 ? (
          <p>{t("leave.nonePending")}</p>
        ) : (
          <ul className="list">
            {queue.pending.map((request) => (
              <LeaveRequestItem key={request.id} request={request} showRequester requesterClass={request.class}>
                {request.canDecide !== false && (
                  <div className="leave-actions">
                    {button(request, "approved", t("leave.approve"))}
                    {button(request, "rejected", t("leave.reject"))}
                  </div>
                )}
              </LeaveRequestItem>
            ))}
          </ul>
        )}
      </section>
      <section className="card" aria-labelledby={`${idPrefix}-decided`}>
        <h2 id={`${idPrefix}-decided`}>{t("leave.decided")}</h2>
        {queue.decided.length === 0 ? (
          <p>{t("leave.noneDecided")}</p>
        ) : (
          <ul className="list">
            {queue.decided.map((request) => {
              const other = request.status === "approved" ? "rejected" : "approved";
              return (
                <LeaveRequestItem key={request.id} request={request} showRequester requesterClass={request.class}>
                  {request.canDecide === false ? (
                    <p className="muted">{t("leave.adminHasFinalSay")}</p>
                  ) : (
                    <div className="leave-actions">
                      {button(request, other, t("leave.changeTo", { status: t(`leave.status.${other}`) }), true)}
                    </div>
                  )}
                </LeaveRequestItem>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

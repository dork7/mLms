// The Admin's Teacher Leave Requests: those waiting for a decision, then those decided,
// each with buttons to approve or reject (or change the decision).
import Link from "next/link";
import { type LeaveRequestRow, teacherLeaveRequests } from "@/core/leave/leave-requests";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import { LeaveRequestItem } from "../../leave-request-item";
import { decideLeaveAction } from "./actions";

export default async function AdminLeavePage() {
  let queue;
  try {
    queue = await asCurrentActor((ctx) => teacherLeaveRequests(ctx));
  } catch (err) {
    return (
      <main className="page">
        <p className="error">{t(refusalKey(err))}</p>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="topbar">
        <h1>{t("leave.adminTitle")}</h1>
        <Link href="/admin">{t("nav.dashboard")}</Link>
      </header>
      <section className="card" aria-labelledby="pending-leave">
        <h2 id="pending-leave">{t("leave.pending")}</h2>
        {queue.pending.length === 0 ? (
          <p>{t("leave.nonePending")}</p>
        ) : (
          <ul className="list">
            {queue.pending.map((request) => (
              <LeaveRequestItem key={request.id} request={request} showRequester>
                <div className="leave-actions">
                  <DecideButton request={request} decision="approved" label={t("leave.approve")} />
                  <DecideButton request={request} decision="rejected" label={t("leave.reject")} />
                </div>
              </LeaveRequestItem>
            ))}
          </ul>
        )}
      </section>
      <section className="card" aria-labelledby="decided-leave">
        <h2 id="decided-leave">{t("leave.decided")}</h2>
        {queue.decided.length === 0 ? (
          <p>{t("leave.noneDecided")}</p>
        ) : (
          <ul className="list">
            {queue.decided.map((request) => {
              const other = request.status === "approved" ? "rejected" : "approved";
              return (
                <LeaveRequestItem key={request.id} request={request} showRequester>
                  <div className="leave-actions">
                    <DecideButton
                      request={request}
                      decision={other}
                      label={t("leave.changeTo", { status: t(`leave.status.${other}`) })}
                      quiet
                    />
                  </div>
                </LeaveRequestItem>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

function DecideButton({
  request,
  decision,
  label,
  quiet = false,
}: {
  request: LeaveRequestRow;
  decision: "approved" | "rejected";
  label: string;
  quiet?: boolean;
}) {
  return (
    <form action={decideLeaveAction}>
      <input type="hidden" name="leaveRequestId" value={request.id} />
      <input type="hidden" name="decision" value={decision} />
      <button className={quiet ? "button-link" : "button"} type="submit">
        {label}
      </button>
    </form>
  );
}

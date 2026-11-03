// A Teacher's Leave Requests: the form to request leave and the status of each request.
import Link from "next/link";
import { myLeaveRequests } from "@/core/leave/leave-requests";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import { LeaveRequestItem } from "../../leave-request-item";
import { LeaveRequestForm } from "./leave-request-form";

export default async function TeacherLeavePage() {
  let requests;
  try {
    requests = await asCurrentActor((ctx) => myLeaveRequests(ctx));
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
        <h1>{t("leave.myTitle")}</h1>
        <Link href="/teacher">{t("nav.dashboard")}</Link>
      </header>
      <section className="card" aria-labelledby="new-leave">
        <h2 id="new-leave">{t("leave.newTitle")}</h2>
        <LeaveRequestForm />
      </section>
      <section className="card" aria-labelledby="my-leave">
        <h2 id="my-leave">{t("leave.mine")}</h2>
        {requests.length === 0 ? (
          <p>{t("leave.noneMine")}</p>
        ) : (
          <ul className="list">
            {requests.map((request) => (
              <LeaveRequestItem key={request.id} request={request} showRequester={false} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

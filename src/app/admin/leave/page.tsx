// The Admin's Leave Requests: Students' (which their Class Teachers decide and the Admin can
// override) and Teachers' (which only the Admin decides). Each has those waiting for a
// decision, then those decided, with buttons to approve, reject or change the decision.
import Link from "next/link";
import { studentLeaveRequests, teacherLeaveRequests } from "@/core/leave/leave-requests";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import { LeaveOutcome, type LeaveOutcomeQuery } from "../../leave-outcome";
import { LeaveQueue } from "../../leave-queue";
import { decideLeaveAction } from "./actions";

export default async function AdminLeavePage({ searchParams }: { searchParams: Promise<LeaveOutcomeQuery> }) {
  let queues;
  try {
    queues = await asCurrentActor((ctx) => Promise.all([studentLeaveRequests(ctx), teacherLeaveRequests(ctx)]));
  } catch (err) {
    return (
      <main className="page">
        <p className="error">{t(refusalKey(err))}</p>
      </main>
    );
  }
  const [students, teachers] = queues;

  return (
    <main className="page">
      <header className="topbar">
        <h1>{t("leave.adminTitle")}</h1>
        <Link href="/admin">{t("nav.dashboard")}</Link>
      </header>
      <LeaveOutcome query={await searchParams} />
      <section aria-labelledby="student-leave">
        <h2 id="student-leave">{t("leave.fromStudents")}</h2>
        <LeaveQueue queue={students} decide={decideLeaveAction} idPrefix="student-leave" forStudents />
      </section>
      <section aria-labelledby="teacher-leave">
        <h2 id="teacher-leave">{t("leave.fromTeachers")}</h2>
        <LeaveQueue queue={teachers} decide={decideLeaveAction} idPrefix="teacher-leave" forStudents={false} />
      </section>
    </main>
  );
}

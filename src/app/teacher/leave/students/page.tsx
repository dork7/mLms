// A Class Teacher's Student Leave Requests: from the Students in their Classes today, to
// approve or reject. Once the Admin has decided one, only the Admin can change it.
import Link from "next/link";
import { classLeaveRequests } from "@/core/leave/leave-requests";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import { LeaveOutcome, type LeaveOutcomeQuery } from "../../../leave-outcome";
import { LeaveQueue } from "../../../leave-queue";
import { decideClassLeaveAction } from "./actions";

export default async function ClassLeavePage({ searchParams }: { searchParams: Promise<LeaveOutcomeQuery> }) {
  let queue;
  try {
    queue = await asCurrentActor((ctx) => classLeaveRequests(ctx));
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
        <h1>{t("leave.studentsTitle")}</h1>
        <Link href="/teacher">{t("nav.dashboard")}</Link>
      </header>
      <p className="muted">{t("leave.studentsHint")}</p>
      <LeaveOutcome query={await searchParams} />
      <LeaveQueue queue={queue} decide={decideClassLeaveAction} idPrefix="class-leave" forStudents />
    </main>
  );
}

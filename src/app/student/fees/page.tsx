// A Student's own Fee Assignments, with their Fee Status and Payment Records.
import Link from "next/link";
import { studentFeeAssignments } from "@/core/fees/fee-assignments";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import { FeeAssignments } from "../../fee-assignments";

export default async function MyFeesPage() {
  let assignments;
  try {
    assignments = await asCurrentActor((ctx) => studentFeeAssignments(ctx, { studentId: ctx.actor.userId }));
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
        <h1>{t("fees.myTitle")}</h1>
        <Link href="/student">{t("nav.dashboard")}</Link>
      </header>
      <FeeAssignments assignments={assignments} title={t("fees.assignmentsTitle")} />
    </main>
  );
}

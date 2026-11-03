// Where a Student lands: their next Exam and latest Marks, with the way to everything else.
import Link from "next/link";
import { getStudentDashboard } from "@/core/dashboard/student-dashboard";
import { studentFeeAlert } from "@/core/fees/fee-alert";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import { logout } from "../actions";
import { AssessmentHistory } from "../assessment-history";
import { FeeAlert } from "../fee-alert";

export default async function StudentDashboardPage() {
  let data;
  try {
    data = await asCurrentActor((ctx) =>
      Promise.all([getStudentDashboard(ctx), studentFeeAlert(ctx, { studentId: ctx.actor.userId })]),
    );
  } catch (err) {
    return (
      <main className="page">
        <p className="error">{t(refusalKey(err))}</p>
      </main>
    );
  }
  const [{ name, nextExam, latestMarks }, feeAlert] = data;

  return (
    <main className="page">
      <header className="topbar">
        <h1>{t("studentDashboard.title")}</h1>
        <form action={logout}>
          <button className="button-link" type="submit">
            {t("nav.logout")}
          </button>
        </form>
      </header>
      <FeeAlert alert={feeAlert} viewer="student" />
      <section className="card" aria-labelledby="next-exam">
        <p className="muted">{t("studentDashboard.welcome", { name })}</p>
        <h2 id="next-exam">{t("studentDashboard.nextExam")}</h2>
        {nextExam ? (
          <>
            <strong>
              {t("examSchedule.line", {
                subject: nextExam.subject,
                type: t(`assessments.types.${nextExam.type}`),
                class: nextExam.class,
              })}
            </strong>
            <div>{t("examSchedule.when", { date: nextExam.date, start: nextExam.startTime, end: nextExam.endTime })}</div>
            <div>{t("examSchedule.room", { room: nextExam.room })}</div>
          </>
        ) : (
          <p>{t("studentDashboard.noNextExam")}</p>
        )}
      </section>
      <AssessmentHistory
        rows={latestMarks}
        title={t("studentDashboard.latestMarks")}
        none={t("studentDashboard.noMarks")}
      />
      <nav className="card" aria-label={t("studentDashboard.moreHeading")}>
        <ul className="list">
          <li>
            <Link href="/student/exams">{t("nav.myExams")}</Link>
          </li>
          <li>
            <Link href="/student/report-cards">{t("nav.myReportCards")}</Link>
          </li>
          <li>
            <Link href="/student/fees">{t("nav.myFees")}</Link>
          </li>
          <li>
            <Link href="/student/profile">{t("studentProfile.myTitle")}</Link>
          </li>
        </ul>
      </nav>
    </main>
  );
}

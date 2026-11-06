// A Student's or Teacher's own Exam schedule, shared by their two routes. The layer decides
// whose Exams these are. The page is also the printable view: `.no-print` drops what isn't
// the schedule on paper (globals.css), including a Student's past Exams.
import Link from "next/link";
import { myExamSchedule, type ScheduledExam } from "@/core/exams/exam-schedule";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import { PrintButton } from "./print-button";

export async function ExamSchedulePage({ homeHref }: { homeHref: string }) {
  let schedule;
  try {
    schedule = await asCurrentActor((ctx) => myExamSchedule(ctx));
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
        <h1>{t("examSchedule.title")}</h1>
        <Link className="no-print" href={homeHref}>
          {t("nav.dashboard")}
        </Link>
      </header>
      <section className="card" aria-labelledby="exam-schedule-owner">
        <h2 id="exam-schedule-owner">{schedule.name}</h2>
        {schedule.exams.length === 0 ? (
          <p>{t("examSchedule.none")}</p>
        ) : (
          <>
            <ul className="list">
              {schedule.exams.map((exam) => (
                <ExamLine key={exam.id} exam={exam} />
              ))}
            </ul>
            <p className="exam-schedule-actions no-print">
              <PrintButton />
              {/* A plain link: this is a file download, not a page for the router to navigate to. */}
              <a href="/exams/schedule.ics" download>
                {t("examSchedule.calendar")}
              </a>
            </p>
          </>
        )}
      </section>
      {schedule.pastExams.length > 0 && (
        <section className="card no-print" aria-labelledby="past-exams">
          <h2 id="past-exams">{t("examSchedule.pastTitle")}</h2>
          <p className="muted">{t("examSchedule.pastHint")}</p>
          <ul className="list">
            {schedule.pastExams.map((exam) => (
              <ExamLine key={exam.id} exam={exam} />
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function ExamLine({ exam }: { exam: ScheduledExam }) {
  return (
    <li>
      <strong>
        {t("examSchedule.line", {
          subject: exam.subject,
          type: t(`assessments.types.${exam.type}`),
          class: exam.class,
        })}
      </strong>
      <div>{t("examSchedule.when", { date: exam.date, start: exam.startTime, end: exam.endTime })}</div>
      <div>{t("examSchedule.room", { room: exam.room })}</div>
    </li>
  );
}

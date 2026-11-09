// One Exam for the Admin: where and when it is now, the other Classes of a grade-wide
// Exam, and the forms to reschedule it (alone or with those Classes) or delete it. An Exam
// with Marks keeps its date and can't be deleted; a Closed year offers no forms.
import type { Metadata } from "next";
import Link from "next/link";
import { dateText } from "@/app/date-text";
import { clockTime, getExam, startMinute } from "@/core/exams/exams";
import { listRooms } from "@/core/school/catalogue";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import { DeleteExamForm, RescheduleExamForm } from "./forms";

export const metadata: Metadata = { title: t("pageTitles.exam") };

export default async function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  const examId = Number((await params).id);
  let data;
  try {
    data = await asCurrentActor((ctx) => Promise.all([getExam(ctx, { examId }), listRooms(ctx)]));
  } catch (err) {
    return (
      <main className="page">
        <p className="error">{t(refusalKey(err))}</p>
        <Link href="/admin/exams">{t("nav.exams")}</Link>
      </main>
    );
  }
  const [exam, rooms] = data;
  const back = exam.termId === null ? "/admin/exams" : `/admin/exams?term=${exam.termId}`;
  const room = rooms.find((r) => r.id === exam.roomId)?.name ?? "";

  return (
    <main className="page">
      <header className="topbar">
        <h1>
          {t("exams.editTitle", {
            subject: exam.subject,
            type: t(`assessments.types.${exam.type}`),
            class: exam.class,
          })}
        </h1>
        <Link href={back}>{t("exams.backToTimetable")}</Link>
      </header>
      <section className="card">
        <p>
          {t("exams.now", {
            date: dateText(exam.date),
            start: exam.startTime,
            end: clockTime(startMinute(exam.startTime) + exam.durationMinutes),
            room,
          })}
        </p>
        <p>{t("exams.worth", { maxMarks: exam.maxMarks, weight: exam.weight })}</p>
        {exam.academicYear.closed && <p className="muted">{t("yearEnd.closedNotice")}</p>}
      </section>
      {exam.gradeWide.length > 0 && (
        <section className="card" aria-labelledby="grade-wide-heading">
          <h2 id="grade-wide-heading">{t("exams.gradeWideHeading")}</h2>
          <p>{t("exams.gradeWideWith")}</p>
          <ul className="list">
            {exam.gradeWide.map((other) => (
              <li key={other.id}>
                {t("exams.gradeWideLine", { class: other.class, room: other.room })}{" "}
                <Link
                  className="row-action"
                  href={`/admin/exams/${other.id}`}
                  aria-label={t("exams.gradeWideOpen", { class: other.class })}
                >
                  {t("exams.change")}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {!exam.academicYear.closed && (
        <>
          <section className="card" aria-labelledby="reschedule-heading">
            <h2 id="reschedule-heading">{t("exams.rescheduleTitle")}</h2>
            <p className="muted">{t("exams.rescheduleHint")}</p>
            <RescheduleExamForm exam={exam} rooms={rooms} />
          </section>
          <section className="card" aria-labelledby="delete-heading">
            <h2 id="delete-heading">{t("exams.deleteTitle")}</h2>
            {exam.hasMarks ? <p>{t("exams.cantDelete")}</p> : <DeleteExamForm examId={exam.id} termId={exam.termId} />}
          </section>
        </>
      )}
    </main>
  );
}

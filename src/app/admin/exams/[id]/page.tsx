// One Exam for the Admin: reschedule it (date, time, duration, Room) or delete it. An
// Exam with Marks keeps its date and can't be deleted; a Closed year offers no forms.
import Link from "next/link";
import { getExam } from "@/core/exams/exams";
import { listRooms } from "@/core/school/catalogue";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import { DeleteExamForm, RescheduleExamForm } from "./forms";

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
        <p>{t("exams.worth", { maxMarks: exam.maxMarks, weight: exam.weight })}</p>
        {exam.academicYear.closed && <p className="muted">{t("yearEnd.closedNotice")}</p>}
      </section>
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

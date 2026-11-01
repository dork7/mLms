// The Teacher's landing page: what needs Marks, their own Class Subjects, what was last
// taught in them, and the Classes they are Class Teacher of.
import Link from "next/link";
import { listMyClasses } from "@/core/classes/classes";
import { getTeacherDashboard } from "@/core/dashboard/teacher-dashboard";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import { logout } from "../actions";

export default async function TeacherDashboardPage() {
  let data;
  try {
    data = await asCurrentActor((ctx) => Promise.all([getTeacherDashboard(ctx), listMyClasses(ctx)]));
  } catch (err) {
    return (
      <main className="page">
        <p className="error">{t(refusalKey(err))}</p>
      </main>
    );
  }
  const [{ classSubjects, recentLessons, assessmentsNeedingMarks }, classes] = data;

  return (
    <main className="page">
      <header className="topbar">
        <h1>{t("teacherDashboard.title")}</h1>
        <Link href="/teacher/students">{t("myStudents.link")}</Link>
        <Link href="/teacher/exams">{t("nav.myExams")}</Link>
        <form action={logout}>
          <button className="button-link" type="submit">
            {t("nav.logout")}
          </button>
        </form>
      </header>
      <section className="card" aria-labelledby="needing-marks">
        <h2 id="needing-marks">{t("teacherDashboard.needingMarks")}</h2>
        {assessmentsNeedingMarks.length === 0 ? (
          <p>{t("teacherDashboard.noneNeedingMarks")}</p>
        ) : (
          <ul className="list">
            {assessmentsNeedingMarks.map((a) => (
              <li key={a.id}>
                <Link href={`/teacher/assessments/${a.id}`}>
                  {t("teacherDashboard.assessmentLine", {
                    subject: a.subject,
                    class: a.class,
                    type: t(`assessments.types.${a.type}`),
                    date: a.date,
                  })}
                </Link>
                <div className="muted">{t("teacherDashboard.marksToEnter", { count: a.missingMarks })}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card" aria-labelledby="my-class-subjects">
        <h2 id="my-class-subjects">{t("teacherDashboard.myClassSubjects")}</h2>
        {classSubjects.length === 0 ? (
          <p>{t("teacherDashboard.noClassSubjects")}</p>
        ) : (
          <ul className="list">
            {classSubjects.map((cs) => (
              <li key={cs.id}>
                <Link href={`/teacher/class-subjects/${cs.id}`}>
                  {t("classSubject.title", { subject: cs.subject, class: cs.class })}
                </Link>
                <div className="muted">{cs.academicYear}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card" aria-labelledby="recent-lessons">
        <h2 id="recent-lessons">{t("teacherDashboard.recentLessons")}</h2>
        {recentLessons.length === 0 ? (
          <p>{t("lessons.none")}</p>
        ) : (
          <ul className="list">
            {recentLessons.map((lesson) => (
              <li key={lesson.id}>
                <div className="muted">
                  {t("teacherDashboard.lessonLine", {
                    date: lesson.date,
                    period: lesson.period,
                    subject: lesson.subject,
                    class: lesson.class,
                  })}
                </div>
                <div className="lesson-topic">{lesson.topic}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {classes.length > 0 && (
        <section className="card" aria-labelledby="my-classes">
          <h2 id="my-classes">{t("teacherDashboard.myClasses")}</h2>
          <p className="muted">{t("teacherDashboard.myClassesHint")}</p>
          <ul className="list">
            {classes.map((c) => (
              <li key={c.id}>
                <Link href={`/teacher/classes/${c.id}`}>{c.name}</Link>
                <div className="muted">
                  {c.grade}, {c.academicYear}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

// The Teacher's landing page: their own Class Subjects, and the Classes they are
// Class Teacher of. (The fuller Teacher dashboard comes in a later ticket.)
import Link from "next/link";
import { listMyClassSubjects } from "@/core/classes/class-subjects";
import { listMyClasses } from "@/core/classes/classes";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import { logout } from "../actions";

export default async function TeacherDashboardPage() {
  let data;
  try {
    data = await asCurrentActor((ctx) => Promise.all([listMyClassSubjects(ctx), listMyClasses(ctx)]));
  } catch (err) {
    return (
      <main className="page">
        <p className="error">{t(refusalKey(err))}</p>
      </main>
    );
  }
  const [classSubjects, classes] = data;

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

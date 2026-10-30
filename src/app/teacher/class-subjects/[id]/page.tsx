// One Class Subject, for its Subject Teacher or its Class's Class Teacher: its
// Lessons, and (for the Subject Teacher only, as the layer decides) the Lesson form.
// Later tickets add its Assessments here.
import Link from "next/link";
import { getClassSubject } from "@/core/classes/class-subjects";
import { AccessDenied } from "@/core/errors";
import { lessonFormDefaults, listClassSubjectLessons } from "@/core/lessons/lessons";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import { LessonList } from "../../../lesson-list";
import { LessonForm } from "./lesson-form";

export default async function ClassSubjectPage({ params }: { params: Promise<{ id: string }> }) {
  const classSubjectId = Number((await params).id);
  let data;
  try {
    data = await asCurrentActor((ctx) =>
      Promise.all([
        getClassSubject(ctx, { classSubjectId }),
        listClassSubjectLessons(ctx, { classSubjectId }),
        // Only the Subject Teacher may log; anyone else who can see the page gets no form.
        lessonFormDefaults(ctx, { classSubjectId }).catch((err) => {
          if (err instanceof AccessDenied) return null;
          throw err;
        }),
      ]),
    );
  } catch (err) {
    return (
      <main className="page">
        <p className="error">{t(refusalKey(err))}</p>
        <Link href="/teacher">{t("nav.dashboard")}</Link>
      </main>
    );
  }
  const [cs, lessons, form] = data;

  return (
    <main className="page">
      <header className="topbar">
        <h1>{t("classSubject.title", { subject: cs.subject, class: cs.class })}</h1>
        <Link href="/teacher">{t("nav.dashboard")}</Link>
      </header>
      <section className="card">
        <p>{t("classSubject.details", { grade: cs.grade, year: cs.academicYear, teacher: cs.teacher })}</p>
        <Link href={`/teacher/students?classSubjectId=${cs.id}`}>{t("myStudents.title")}</Link>
      </section>
      {form && (
        <section className="card" aria-labelledby="log-lesson">
          <h2 id="log-lesson">{t("lessons.logTitle")}</h2>
          {form.periodsPerDay > 0 ? (
            <LessonForm classSubjectId={classSubjectId} today={form.today} periodsPerDay={form.periodsPerDay} />
          ) : (
            <p>{t("lessons.noPeriods")}</p>
          )}
        </section>
      )}
      <section className="card" aria-labelledby="lessons">
        <h2 id="lessons">{t("lessons.recentTitle")}</h2>
        <LessonList lessons={lessons} />
      </section>
    </main>
  );
}

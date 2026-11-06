// One Class Subject, for its Subject Teacher or its Class's Class Teacher: its
// Lessons and Assessments, and (for the Subject Teacher only, as the layer decides)
// the Lesson and new-Assessment forms.
import Link from "next/link";
import { assessmentFormDefaults, listAssessments } from "@/core/assessments/assessments";
import { getClassSubject } from "@/core/classes/class-subjects";
import { AcademicYearClosed, AccessDenied } from "@/core/errors";
import { lessonFormDefaults, listClassSubjectLessons } from "@/core/lessons/lessons";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import { LessonList } from "../../../lesson-list";
import { statsText } from "../../../mark-text";
import { CreateAssessmentForm } from "../../assessments/forms";
import { LessonForm } from "./lesson-form";

export default async function ClassSubjectPage({ params }: { params: Promise<{ id: string }> }) {
  const classSubjectId = Number((await params).id);
  let data;
  try {
    data = await asCurrentActor((ctx) =>
      Promise.all([
        getClassSubject(ctx, { classSubjectId }),
        listClassSubjectLessons(ctx, { classSubjectId }),
        lessonFormDefaults(ctx, { classSubjectId }).catch(nullIfDenied),
        listAssessments(ctx, { classSubjectId }),
        assessmentFormDefaults(ctx, { classSubjectId }).catch(nullIfDenied),
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
  const [cs, lessons, form, assessments, assessmentForm] = data;

  return (
    <main className="page">
      <header className="topbar">
        <h1>{t("classSubject.title", { subject: cs.subject, class: cs.class })}</h1>
        <Link href="/teacher">{t("nav.dashboard")}</Link>
      </header>
      <section className="card">
        {cs.yearClosed && <p className="muted">{t("yearEnd.closedNotice")}</p>}
        <p>{t("classSubject.details", { grade: cs.grade, year: cs.academicYear, teacher: cs.teacher })}</p>
        <p>
          <Link href={`/teacher/students?classSubjectId=${cs.id}`}>{t("myStudents.title")}</Link>
        </p>
        <p>
          <Link href={`/teacher/class-subjects/${cs.id}/term-grades`}>{t("termGrades.title")}</Link>
        </p>
        {assessmentForm && (
          <p>
            <Link href={`/teacher/class-subjects/${cs.id}/remarks`}>{t("remarks.subjectLink")}</Link>
          </p>
        )}
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
      {assessmentForm && (
        <section className="card" aria-labelledby="new-assessment">
          <h2 id="new-assessment">{t("assessments.createTitle")}</h2>
          <CreateAssessmentForm classSubjectId={classSubjectId} today={assessmentForm.today} types={assessmentForm.types} />
        </section>
      )}
      <section className="card" aria-labelledby="assessments">
        <h2 id="assessments">{t("assessments.title")}</h2>
        {assessments.length === 0 ? (
          <p>{t("assessments.none")}</p>
        ) : (
          <ul className="list">
            {assessments.map((a) => (
              <li key={a.id} className="list-item">
                <Link href={`/teacher/assessments/${a.id}`}>
                  {t("assessments.linkName", { type: t(`assessments.types.${a.type}`), date: a.date })}
                </Link>
                <div className="muted">
                  {a.term ?? t("assessments.noTerm")}. {statsText(a.stats)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card" aria-labelledby="lessons">
        <h2 id="lessons">{t("lessons.recentTitle")}</h2>
        <LessonList lessons={lessons} />
      </section>
    </main>
  );
}

// Only the Subject Teacher may log or create; anyone else who can see the page gets no form.
function nullIfDenied(err: unknown): null {
  if (err instanceof AccessDenied || err instanceof AcademicYearClosed) return null;
  throw err;
}

// The Admin's exam timetable for one Term (?term=<id>, by default the Term today falls
// in), with grade-wide Exams shown together, and the form that adds an Exam.
import Link from "next/link";
import { ASSESSMENT_TYPES } from "@/core/assessments/assessments";
import { listYearClassSubjects } from "@/core/classes/class-subjects";
import { examTimetable } from "@/core/exams/exams";
import { getSchoolSetup } from "@/core/school/school-setup";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import { AddExamForm } from "./add-exam-form";

export default async function ExamsPage({ searchParams }: { searchParams: Promise<{ term?: string | string[] }> }) {
  const { term } = await searchParams;
  const termId = typeof term === "string" && term !== "" ? Number(term) : undefined;

  let data;
  try {
    data = await asCurrentActor(async (ctx) => {
      const [timetable, setup] = await Promise.all([examTimetable(ctx, { termId }), getSchoolSetup(ctx)]);
      const classSubjects = timetable
        ? await listYearClassSubjects(ctx, { academicYearId: timetable.term.academicYearId })
        : [];
      return { timetable, setup, classSubjects };
    });
  } catch (err) {
    return (
      <main className="page">
        <p className="error">{t(refusalKey(err))}</p>
        <Link href="/admin/exams">{t("nav.exams")}</Link>
      </main>
    );
  }
  const { timetable, setup, classSubjects } = data;

  return (
    <main className="page">
      <header className="topbar">
        <h1>{t("exams.title")}</h1>
        <Link href="/admin">{t("nav.dashboard")}</Link>
      </header>
      {!timetable ? (
        <section className="card">
          <p>{t("exams.noTerms")}</p>
        </section>
      ) : (
        <>
          <section className="card">
            <form method="get" className="inline-form">
              <label className="field">
                {t("exams.term")}
                <select name="term" defaultValue={String(timetable.term.id)}>
                  {setup.academicYears.flatMap((year) =>
                    year.terms.map((yearTerm) => (
                      <option key={yearTerm.id} value={String(yearTerm.id)}>
                        {t("exams.termOption", { year: year.name, term: yearTerm.name })}
                      </option>
                    )),
                  )}
                </select>
              </label>
              <button className="button" type="submit">
                {t("exams.show")}
              </button>
            </form>
          </section>
          <section className="card" aria-labelledby="timetable-heading">
            <h2 id="timetable-heading">
              {t("exams.timetableTitle", { term: timetable.term.name, year: timetable.term.academicYear })}
            </h2>
            {timetable.groups.length === 0 ? (
              <p>{t("exams.none")}</p>
            ) : (
              timetable.groups.map((group) => {
                const title = t("exams.groupTitle", {
                  grade: group.grade,
                  subject: group.subject,
                  type: t(`assessments.types.${group.type}`),
                  date: group.date,
                  start: group.startTime,
                  end: group.endTime,
                });
                return (
                  <section key={group.exams[0].id} className="exam-group" aria-label={title}>
                    <h3>{title}</h3>
                    <ul className="list">
                      {group.exams.map((exam) => (
                        <li key={exam.id}>
                          {t("exams.line", { class: exam.class, room: exam.room, teacher: exam.teacher })}
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })
            )}
          </section>
          <section className="card" aria-labelledby="add-exam-heading">
            <h2 id="add-exam-heading">{t("exams.addTitle")}</h2>
            {setup.academicYears.find((year) => year.id === timetable.term.academicYearId)?.closed ? (
              <p>{t("yearEnd.closedNotice")}</p>
            ) : classSubjects.length === 0 || setup.rooms.length === 0 ? (
              <p>{t("exams.needsSetup")}</p>
            ) : (
              <>
                <p className="muted">{t("exams.addHint")}</p>
                <AddExamForm
                  key={timetable.term.id}
                  classSubjects={classSubjects.map((cs) => ({
                    id: cs.id,
                    name: t("classSubject.title", { subject: cs.subject, class: cs.class }),
                  }))}
                  rooms={setup.rooms}
                  types={ASSESSMENT_TYPES.map((type) => ({ id: type, name: t(`assessments.types.${type}`) }))}
                  firstDay={timetable.term.startDate}
                  lastDay={timetable.term.endDate}
                />
              </>
            )}
          </section>
        </>
      )}
    </main>
  );
}

// The Admin's exam timetable for one Term (?term=<id>, by default the Term today falls
// in), with grade-wide Exams shown together, each Exam linking to its page to reschedule
// or delete it, and the forms that add Exams, folded once the Term has Exams.
import type { Metadata } from "next";
import Link from "next/link";
import { dateText } from "@/app/date-text";
import { Disclosure } from "@/app/disclosure";
import { Flash } from "@/app/form-kit";
import { ASSESSMENT_TYPES } from "@/core/assessments/assessments";
import { listYearClassSubjects } from "@/core/classes/class-subjects";
import { examTimetable, gradeWideExamChoices } from "@/core/exams/exams";
import { getSchoolSetup } from "@/core/school/school-setup";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import { AddExamForm } from "./add-exam-form";
import { AddGradeWideExamForm } from "./add-grade-wide-exam-form";

export const metadata: Metadata = { title: t("pageTitles.examTimetable") };

export default async function ExamsPage({
  searchParams,
}: {
  searchParams: Promise<{ term?: string | string[]; deleted?: string | string[] }>;
}) {
  const { term, deleted } = await searchParams;
  const termId = typeof term === "string" && term !== "" ? Number(term) : undefined;

  let data;
  try {
    data = await asCurrentActor(async (ctx) => {
      const [timetable, setup] = await Promise.all([examTimetable(ctx, { termId }), getSchoolSetup(ctx)]);
      const academicYearId = timetable?.term.academicYearId;
      const [classSubjects, gradeWideChoices] =
        academicYearId === undefined
          ? [[], []]
          : await Promise.all([
              listYearClassSubjects(ctx, { academicYearId }),
              gradeWideExamChoices(ctx, { academicYearId }),
            ]);
      return { timetable, setup, classSubjects, gradeWideChoices };
    });
  } catch (err) {
    return (
      <main className="page">
        <p className="error">{t(refusalKey(err))}</p>
        <Link href="/admin/exams">{t("nav.exams")}</Link>
      </main>
    );
  }
  const { timetable, setup, classSubjects, gradeWideChoices } = data;
  const types = ASSESSMENT_TYPES.map((type) => ({ id: type, name: t(`assessments.types.${type}`) }));
  const yearClosed = setup.academicYears.find((year) => year.id === timetable?.term.academicYearId)?.closed;
  const ready = classSubjects.length > 0 && setup.rooms.length > 0;

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
            {deleted === "1" && (
              <Flash kind="success" dropParam="deleted">
                {t("exams.deleted")}
              </Flash>
            )}
            {timetable.groups.length === 0 ? (
              <p>{t("exams.none")}</p>
            ) : (
              timetable.groups.map((group) => {
                const title = t("exams.groupTitle", {
                  grade: group.grade,
                  subject: group.subject,
                  type: t(`assessments.types.${group.type}`),
                  date: dateText(group.date),
                  start: group.startTime,
                  end: group.endTime,
                });
                return (
                  <section key={group.exams[0].id} className="exam-group" aria-label={title}>
                    <h3>{title}</h3>
                    <ul className="list">
                      {group.exams.map((exam) => (
                        <li key={exam.id}>
                          {t("exams.line", { class: exam.class, room: exam.room, teacher: exam.teacher })}{" "}
                          <Link
                            className="row-action"
                            href={`/admin/exams/${exam.id}`}
                            aria-label={t("exams.changeLabel", {
                              type: t(`assessments.types.${group.type}`),
                              class: exam.class,
                              date: dateText(group.date),
                              start: group.startTime,
                            })}
                          >
                            {t("exams.change")}
                          </Link>
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
            {yearClosed ? (
              <p>{t("yearEnd.closedNotice")}</p>
            ) : !ready ? (
              <p>{t("exams.needsSetup")}</p>
            ) : (
              <Disclosure
                key={timetable.term.id}
                show={t("exams.showForm")}
                hide={t("exams.hideForm")}
                initiallyOpen={timetable.groups.length === 0}
              >
                <p className="muted">{t("exams.addHint")}</p>
                <AddExamForm
                  key={timetable.term.id}
                  classSubjects={classSubjects.map((cs) => ({
                    id: cs.id,
                    name: t("classSubject.title", { subject: cs.subject, class: cs.class }),
                  }))}
                  rooms={setup.rooms}
                  types={types}
                  firstDay={timetable.term.startDate}
                  lastDay={timetable.term.endDate}
                />
              </Disclosure>
            )}
          </section>
          {!yearClosed && ready && (
            <section className="card" aria-labelledby="add-grade-wide-exam-heading">
              <h2 id="add-grade-wide-exam-heading">{t("exams.gradeWideTitle")}</h2>
              <Disclosure
                key={timetable.term.id}
                show={t("exams.showForm")}
                hide={t("exams.hideForm")}
                initiallyOpen={timetable.groups.length === 0}
              >
                <p className="muted">{t("exams.gradeWideHint")}</p>
                <AddGradeWideExamForm
                  key={timetable.term.id}
                  academicYearId={timetable.term.academicYearId}
                  choices={gradeWideChoices}
                  rooms={setup.rooms}
                  types={types}
                  firstDay={timetable.term.startDate}
                  lastDay={timetable.term.endDate}
                />
              </Disclosure>
            </section>
          )}
        </>
      )}
    </main>
  );
}

// One Term's Term Grades in a Class Subject, for its Subject Teacher or its Class's
// Class Teacher (the layer decides). A Student who moved mid-Term shows their whole
// Term Grade, from every Class they were in.
import Link from "next/link";
import { classSubjectTermGrades } from "@/core/grading/term-grades";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import { termGradeNotes, termGradeText } from "../../../../term-grade-text";

export default async function ClassSubjectTermGradesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const classSubjectId = Number((await params).id);
  const { termId } = await searchParams;
  let page;
  try {
    page = await asCurrentActor((ctx) =>
      classSubjectTermGrades(ctx, {
        classSubjectId,
        termId: typeof termId === "string" && termId !== "" ? Number(termId) : undefined,
      }),
    );
  } catch (err) {
    return (
      <main className="page">
        <p className="error">{t(refusalKey(err))}</p>
        <Link href="/teacher">{t("nav.dashboard")}</Link>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="topbar">
        <h1>{t("termGrades.pageTitle", { subject: page.subject, class: page.class })}</h1>
        <Link href={`/teacher/class-subjects/${classSubjectId}`}>
          {t("termGrades.backToClassSubject", { subject: page.subject, class: page.class })}
        </Link>
      </header>
      <section className="card" aria-labelledby="term-grades">
        <h2 id="term-grades">{t("termGrades.termHeading", { term: page.term.name, year: page.term.academicYear })}</h2>
        <form method="get" className="inline-form">
          <label className="field">
            {t("termGrades.term")}
            <select name="termId" defaultValue={page.term.id}>
              {page.terms.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.name}
                </option>
              ))}
            </select>
          </label>
          <button className="button" type="submit">
            {t("termGrades.show")}
          </button>
        </form>
        {page.rows.length === 0 ? (
          <p>{t("termGrades.noStudents")}</p>
        ) : (
          <ul className="list">
            {page.rows.map((row) => (
              <li key={row.studentId} className="list-item">
                <div>
                  {t("termGrades.studentLine", { name: row.name, studentNumber: row.studentNumber })}
                  <div className="muted">
                    {row.issuingClass
                      ? t("termGrades.issuingClass", { class: row.issuingClass })
                      : t("termGrades.noIssuingClass")}
                  </div>
                  {termGradeNotes(row.grade) && <div className="muted">{termGradeNotes(row.grade)}</div>}
                </div>
                <strong>{termGradeText(row.grade)}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

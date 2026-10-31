// A Student's Term Grades by Term, newest first. The layer has already left out
// whatever the viewer may not see.
import type { StudentTerm } from "@/core/grading/term-grades";
import { t } from "@/i18n";
import { termGradeNotes, termGradeText } from "./term-grade-text";

export function TermGrades({ terms }: { terms: StudentTerm[] }) {
  return (
    <section className="card" aria-labelledby="term-grades">
      <h2 id="term-grades">{t("termGrades.title")}</h2>
      {terms.length === 0 && <p>{t("termGrades.none")}</p>}
      {terms.map(({ term, issuingClass, grades }) => (
        <div key={term.id} role="group" aria-label={t("termGrades.termHeading", { term: term.name, year: term.academicYear })}>
          <h3>{t("termGrades.termHeading", { term: term.name, year: term.academicYear })}</h3>
          <p className="muted">
            {issuingClass
              ? t("termGrades.issuingClass", { class: issuingClass.name })
              : t("termGrades.noIssuingClass")}
          </p>
          <ul className="list">
            {grades.map((g) => (
              <li key={g.subjectId} className="list-item">
                <div>
                  {g.subject}
                  {termGradeNotes(g) && <div className="muted">{termGradeNotes(g)}</div>}
                </div>
                <strong>{termGradeText(g)}</strong>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

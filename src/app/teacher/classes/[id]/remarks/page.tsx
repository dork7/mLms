// A Class Teacher's overall remarks for one Term: each Student whose Issuing Class this
// is, with every Term Grade on their Report Card and the overall percentage.
import Link from "next/link";
import { overallRemarkSheet } from "@/core/report-cards/remarks";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import { overallText } from "../../../../report-card-text";
import { termGradeText } from "../../../../term-grade-text";
import { TermPicker, termIdFrom } from "../../../../term-picker";
import { saveOverallRemarkAction } from "../../../remark-actions";
import { RemarkForm } from "../../../remark-form";

export default async function OverallRemarksPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const classId = Number((await params).id);
  const { termId } = await searchParams;
  let sheet;
  try {
    sheet = await asCurrentActor((ctx) => overallRemarkSheet(ctx, { classId, termId: termIdFrom(termId) }));
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
        <h1>{t("remarks.overallTitle", { class: sheet.class })}</h1>
        <Link href={`/teacher/classes/${classId}`}>{t("remarks.backToClass", { class: sheet.class })}</Link>
      </header>
      <section className="card" aria-labelledby="term">
        <h2 id="term">{t("remarks.termHeading", { term: sheet.term.name, year: sheet.term.academicYear })}</h2>
        <TermPicker key={sheet.term.id} terms={sheet.terms} termId={sheet.term.id} />
        <p className="muted">{t("remarks.cleared")}</p>
        {sheet.rows.length === 0 && <p>{t("remarks.overallEmpty")}</p>}
      </section>
      {sheet.rows.map((row) => (
        <section className="card" key={row.studentId} aria-labelledby={`student-${row.studentId}`}>
          <h2 id={`student-${row.studentId}`}>
            {t("termGrades.studentLine", { name: row.name, studentNumber: row.studentNumber })}
          </h2>
          <ul className="list">
            {row.grades.map((grade) => (
              <li key={grade.subjectId} className="list-item">
                <span>{grade.subject}</span>
                <strong>{termGradeText(grade)}</strong>
              </li>
            ))}
          </ul>
          <p>
            <strong>{overallText(row.overallPercent)}</strong>
          </p>
          <RemarkForm
            key={sheet.term.id}
            action={saveOverallRemarkAction}
            label={t("remarks.overallLabel", { name: row.name })}
            fields={{ classId, termId: sheet.term.id, studentId: row.studentId }}
            remark={row.overallRemark}
          />
        </section>
      ))}
    </main>
  );
}

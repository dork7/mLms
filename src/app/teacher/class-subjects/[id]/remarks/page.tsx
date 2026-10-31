// A Subject Teacher's remarks for one Term: each Student whose remark falls to this Class
// Subject, with their whole Term Grade across Classes.
import Link from "next/link";
import { subjectRemarkSheet } from "@/core/report-cards/remarks";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import { termGradeNotes, termGradeText } from "../../../../term-grade-text";
import { TermPicker, termIdFrom } from "../../../../term-picker";
import { saveSubjectRemarkAction } from "../../../remark-actions";
import { RemarkForm } from "../../../remark-form";

export default async function SubjectRemarksPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const classSubjectId = Number((await params).id);
  const { termId } = await searchParams;
  let sheet;
  try {
    sheet = await asCurrentActor((ctx) => subjectRemarkSheet(ctx, { classSubjectId, termId: termIdFrom(termId) }));
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
        <h1>{t("remarks.subjectTitle", { subject: sheet.subject, class: sheet.class })}</h1>
        <Link href={`/teacher/class-subjects/${classSubjectId}`}>
          {t("remarks.backToClassSubject", { subject: sheet.subject, class: sheet.class })}
        </Link>
      </header>
      <section className="card" aria-labelledby="term">
        <h2 id="term">{t("remarks.termHeading", { term: sheet.term.name, year: sheet.term.academicYear })}</h2>
        <TermPicker key={sheet.term.id} terms={sheet.terms} termId={sheet.term.id} />
        {sheet.yearClosed ? (
          <p className="muted">{t("yearEnd.closedNotice")}</p>
        ) : (
          <>
            <p className="muted">{t("remarks.subjectHint")}</p>
            <p className="muted">{t("remarks.cleared")}</p>
          </>
        )}
        {sheet.rows.length === 0 && <p>{t("remarks.subjectEmpty")}</p>}
      </section>
      {sheet.rows.map((row) => (
        <section className="card" key={row.studentId} aria-labelledby={`student-${row.studentId}`}>
          <h2 id={`student-${row.studentId}`}>
            {t("termGrades.studentLine", { name: row.name, studentNumber: row.studentNumber })}
          </h2>
          <p>
            <strong>{termGradeText(row.grade)}</strong>
          </p>
          {termGradeNotes(row.grade) && <p className="muted">{termGradeNotes(row.grade)}</p>}
          {sheet.yearClosed ? (
            <p className="remark">{row.remark ?? t("reportCards.remarkNone")}</p>
          ) : (
            <RemarkForm
              key={sheet.term.id}
              action={saveSubjectRemarkAction}
              label={t("remarks.label", { name: row.name })}
              fields={{ classSubjectId, termId: sheet.term.id, studentId: row.studentId }}
              remark={row.remark}
            />
          )}
        </section>
      ))}
    </main>
  );
}

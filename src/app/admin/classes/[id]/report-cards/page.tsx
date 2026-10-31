// The Admin's preview of a Class's Report Cards for a Term: each Student whose Issuing
// Class it is, with their Term Grades, remarks, overall percentage, rank if it's on, and
// what's still missing.
import Link from "next/link";
import { classReportCards } from "@/core/report-cards/report-cards";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import { flagText, overallText } from "../../../../report-card-text";
import { TermPicker, termIdFrom } from "../../../../term-picker";
import { termGradeNotes, termGradeText } from "../../../../term-grade-text";

export default async function ReportCardPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const classId = Number((await params).id);
  const { termId } = await searchParams;
  let page;
  try {
    page = await asCurrentActor((ctx) => classReportCards(ctx, { classId, termId: termIdFrom(termId) }));
  } catch (err) {
    return (
      <main className="page">
        <p className="error">{t(refusalKey(err))}</p>
        <Link href="/admin/report-cards">{t("reportCards.backToReportCards")}</Link>
      </main>
    );
  }
  const incomplete = page.cards.filter((card) => card.flags.length > 0).length;

  return (
    <main className="page">
      <header className="topbar">
        <h1>{t("reportCards.previewTitle", { class: page.class })}</h1>
        <Link href="/admin/report-cards">{t("reportCards.backToReportCards")}</Link>
      </header>
      <section className="card" aria-labelledby="term">
        <h2 id="term">{t("termGrades.termHeading", { term: page.term.name, year: page.term.academicYear })}</h2>
        <TermPicker key={page.term.id} terms={page.terms} termId={page.term.id} />
        {page.cards.length === 0 ? (
          <p>{t("reportCards.noCards")}</p>
        ) : (
          <p>
            {incomplete > 0
              ? t("reportCards.summaryIncomplete", { incomplete, total: page.cards.length })
              : t("reportCards.summaryComplete", { total: page.cards.length })}
          </p>
        )}
      </section>
      {page.cards.map((card) => (
        <section className="card" key={card.studentId} aria-labelledby={`card-${card.studentId}`}>
          <h2 id={`card-${card.studentId}`}>
            {t("termGrades.studentLine", { name: card.name, studentNumber: card.studentNumber })}
          </h2>
          <p>
            <strong>{overallText(card.overallPercent)}</strong>
            {page.rankEnabled && (
              <>
                {" · "}
                <strong>
                  {card.rank === null ? t("reportCards.noRank") : t("reportCards.rank", { rank: card.rank })}
                </strong>
              </>
            )}
          </p>
          <ul className="list">
            {card.grades.map((grade) => (
              <li key={grade.subjectId}>
                <div className="list-item">
                  <span>{grade.subject}</span>
                  <strong>{termGradeText(grade)}</strong>
                </div>
                {termGradeNotes(grade) && <div className="muted">{termGradeNotes(grade)}</div>}
                <div className="muted remark">
                  {grade.remark === null
                    ? t("reportCards.remarkNone")
                    : t("reportCards.remarkFrom", { teacher: grade.teacher, remark: grade.remark })}
                </div>
              </li>
            ))}
          </ul>
          <h3>{t("reportCards.overallRemarkHeading")}</h3>
          <p className="remark">
            {card.overallRemark === null
              ? t("reportCards.remarkNone")
              : t("reportCards.remarkFrom", { teacher: card.classTeacher, remark: card.overallRemark })}
          </p>
          {card.flags.length > 0 && (
            <>
              <h3 id={`missing-${card.studentId}`}>{t("reportCards.missingHeading")}</h3>
              <ul className="flags" aria-labelledby={`missing-${card.studentId}`}>
                {card.flags.map((flag) => (
                  <li key={flagText(flag)}>{flagText(flag)}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      ))}
    </main>
  );
}

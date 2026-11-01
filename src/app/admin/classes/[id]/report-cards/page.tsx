// The Admin's preview of a Class's Report Cards for a Term: each Student whose Issuing
// Class it is, with their Term Grades, remarks, overall percentage, rank if it's on, and
// what's still missing. It's also where the Admin Publishes and unpublishes them.
import Link from "next/link";
import { classReportCards } from "@/core/report-cards/report-cards";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import { ReportCardBody } from "../../../../report-card-body";
import { flagText } from "../../../../report-card-text";
import { TermPicker, termIdFrom } from "../../../../term-picker";
import { whenText } from "../../../../when-text";
import { PublishForm } from "./publish-form";

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
  const pdfPath = `/admin/classes/${classId}/report-cards/pdf`;

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
        {page.cards.length > 0 && (
          <p>
            <a href={`${pdfPath}?termId=${page.term.id}`} download>
              {t(page.publication ? "reportCardPdf.exportClass" : "reportCardPdf.exportClassDraft")}
            </a>
          </p>
        )}
      </section>
      <section className="card" aria-labelledby="publish">
        <h2 id="publish">{t("publish.heading")}</h2>
        {page.publication ? (
          <p>{t("publish.published", { name: page.publication.publishedBy, when: whenText(page.publication.publishedAt) })}</p>
        ) : (
          <p>{t("publish.notPublished")}</p>
        )}
        {page.yearClosed ? (
          <p className="muted">{t("publish.closed")}</p>
        ) : page.publication ? (
          <>
            <p className="muted">{t("publish.unpublishHint")}</p>
            <PublishForm key={`published-${page.term.id}`} classId={classId} termId={page.term.id} published />
          </>
        ) : (
          page.cards.length > 0 && (
            <>
              <p className="muted">{t("publish.publishHint")}</p>
              {incomplete > 0 && <p className="muted">{t("publish.publishIncomplete", { incomplete })}</p>}
              <PublishForm key={`draft-${page.term.id}`} classId={classId} termId={page.term.id} published={false} />
            </>
          )
        )}
        {page.publicationHistory.length > 0 && (
          <>
            <h3 id="publish-record">{t("publish.historyHeading")}</h3>
            <ul className="list" aria-labelledby="publish-record">
              {page.publicationHistory.map((record) => (
                <li key={record.id}>
                  <div>{t("publish.historyPublished", { name: record.publishedBy, when: whenText(record.publishedAt) })}</div>
                  {record.unpublishedAt && (
                    <div>
                      {t("publish.historyUnpublished", {
                        name: record.unpublishedBy ?? "",
                        when: whenText(record.unpublishedAt),
                      })}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      {page.cards.map((card) => (
        <section className="card" key={card.studentId} aria-labelledby={`card-${card.studentId}`}>
          <h2 id={`card-${card.studentId}`}>
            {t("termGrades.studentLine", { name: card.name, studentNumber: card.studentNumber })}
          </h2>
          <ReportCardBody card={card} rankShown={page.rankEnabled} />
          <p>
            <a href={`${pdfPath}?termId=${page.term.id}&studentId=${encodeURIComponent(card.studentId)}`} download>
              {t(page.publication ? "reportCardPdf.export" : "reportCardPdf.exportDraft")}
            </a>
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
      {page.noReportCard.length > 0 && (
        <section className="card" aria-labelledby="no-report-card">
          <h2 id="no-report-card">{t("reportCards.noReportCardHeading")}</h2>
          <p className="muted">{t("reportCards.noReportCardHint")}</p>
          <ul className="list">
            {page.noReportCard.map((student) => (
              <li key={student.studentId}>
                <Link href={`/admin/students/${student.studentId}`}>
                  {t("termGrades.studentLine", { name: student.name, studentNumber: student.studentNumber })}
                </Link>
                <div className="muted">{t("reportCards.lastDay", { date: student.lastDay })}</div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

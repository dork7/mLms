// A Student's Published Report Cards, newest Term first, for their own page and the Admin's
// view of their profile.
import type { StudentReportCard } from "@/core/report-cards/publish";
import { t } from "@/i18n";
import { ReportCardBody } from "./report-card-body";

export function PublishedReportCards({ cards }: { cards: StudentReportCard[] }) {
  return cards.map((card) => (
    <section className="card" key={card.publicationId} aria-labelledby={`report-card-${card.publicationId}`}>
      <h2 id={`report-card-${card.publicationId}`}>
        {t("publish.studentHeading", { term: card.term.name, year: card.term.academicYear })}
      </h2>
      <p className="muted">{t("publish.issuedBy", { class: card.issuingClass.name, grade: card.issuingClass.grade })}</p>
      <ReportCardBody card={card} rankShown={card.rankShown} />
      {/* A plain link: next/link would try to route to a file. */}
      <a href={`/students/${card.studentId}/report-cards/${card.publicationId}/pdf`} download>
        {t("reportCardPdf.download")}
      </a>
    </section>
  ));
}

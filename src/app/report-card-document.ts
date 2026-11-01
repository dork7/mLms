// The document a Report Card PDF is rendered from, one Student to a page. It's a string because
// react-dom/server isn't available to route handlers, so it mirrors `ReportCardBody` by hand,
// using the same text helpers. Everything from the database goes through `escaped`.
import type { PrintableReportCard } from "@/core/report-cards/export";
import { dir, locale, t } from "@/i18n";
import { overallText } from "./report-card-text";
import { termGradeNotes, termGradeText } from "./term-grade-text";
import { whenText } from "./when-text";

export function reportCardsHtml(cards: PrintableReportCard[]): string {
  return `<!DOCTYPE html>
<html lang="${escaped(locale)}" dir="${escaped(dir)}">
<head><meta charset="utf-8"><title>${escaped(t("reportCardPdf.title"))}</title><style>${STYLES}</style></head>
<body>${cards.map(sheet).join("")}</body>
</html>`;
}

function sheet({ card, term, rankShown, publishedAt }: PrintableReportCard): string {
  const rank = !rankShown
    ? ""
    : ` · ${card.rank === null ? t("reportCards.noRank") : t("reportCards.rank", { rank: card.rank })}`;
  return `<section class="sheet">
  ${publishedAt === null ? `<p class="draft">${escaped(t("reportCardPdf.draft"))}</p>` : ""}
  <h1>${escaped(t("reportCardPdf.title"))}</h1>
  <h2>${escaped(t("termGrades.studentLine", { name: card.name, studentNumber: card.studentNumber }))}</h2>
  <p>${escaped(t("publish.studentHeading", { term: term.name, year: term.academicYear }))}<br>
  ${escaped(t("publish.issuedBy", { class: card.issuingClass.name, grade: card.issuingClass.grade }))}</p>
  <p class="overall">${escaped(overallText(card.overallPercent) + rank)}</p>
  <ul>${card.grades.map(gradeRow).join("")}</ul>
  <h3>${escaped(t("reportCards.overallRemarkHeading"))}</h3>
  <p class="remark">${escaped(remarkText(card.classTeacher, card.overallRemark))}</p>
  ${publishedAt === null ? "" : `<p class="muted">${escaped(t("reportCardPdf.publishedOn", { when: whenText(publishedAt) }))}</p>`}
</section>`;
}

function gradeRow(grade: PrintableReportCard["card"]["grades"][number]): string {
  const notes = termGradeNotes(grade);
  return `<li>
    <div class="grade"><span>${escaped(grade.subject)}</span><strong>${escaped(termGradeText(grade))}</strong></div>
    ${notes ? `<div class="muted">${escaped(notes)}</div>` : ""}
    <div class="muted remark">${escaped(remarkText(grade.teacher, grade.remark))}</div>
  </li>`;
}

function remarkText(teacher: string, remark: string | null): string {
  return remark === null ? t("reportCards.remarkNone") : t("reportCards.remarkFrom", { teacher, remark });
}

function escaped(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// Logical properties only, like globals.css. Nothing loads from outside the document.
const STYLES = `
* { box-sizing: border-box; }
body { margin: 0; color: #1a1a1a; font: 11pt/1.45 "Noto Sans", "Liberation Sans", Arial, sans-serif; overflow-wrap: anywhere; }
.sheet { break-after: page; }
.sheet:last-child { break-after: auto; }
h1 { font-size: 18pt; margin-block: 0 0.25rem; }
h2 { font-size: 13pt; margin-block: 0 0.5rem; }
h3 { font-size: 11pt; margin-block: 1rem 0.25rem; }
p { margin-block: 0 0.5rem; }
ul { list-style: none; margin: 0; padding: 0; border-block-start: 1px solid #d8d8d4; }
li { padding-block: 0.5rem; border-block-end: 1px solid #d8d8d4; break-inside: avoid; }
.grade { display: flex; justify-content: space-between; gap: 1rem; }
.overall { font-weight: bold; }
.muted { color: #555; font-size: 10pt; }
.remark { white-space: pre-wrap; }
.draft { border: 1px solid #b00020; color: #b00020; font-weight: bold; padding: 0.25rem 0.5rem; }
`;

// Report Cards to print or download. This is the data a PDF is rendered from, and it comes
// from the same queries as the screens, so a PDF can't disagree with what's shown.
//
// A Student only ever gets a Published Report Card. The Admin can also export a Class's before
// Publish, to check or proof it: `publishedAt` is then null, and the document must say draft.
import { requireId } from "../access";
import type { Ctx } from "../context";
import { NotFound } from "../errors";
import { studentReportCards } from "./publish";
import { classReportCards, type PublishedCard } from "./report-cards";

export type PrintableReportCard = {
  card: PublishedCard;
  term: { name: string; academicYear: string };
  rankShown: boolean;
  /** Null for a draft: a Report Card that isn't Published. */
  publishedAt: Date | null;
};

export type ReportCardExport = {
  /** Plain ASCII, so it's safe in a Content-Disposition header. */
  fileName: string;
  cards: PrintableReportCard[];
};

/** One Student's Published Report Card: for that Student and the Admin. */
export async function studentReportCardExport(
  ctx: Ctx,
  input: { studentId: string; publicationId: number },
): Promise<ReportCardExport> {
  const published = await studentReportCards(ctx, { studentId: input.studentId });
  requireId(input.publicationId);
  const found = published.find((p) => p.publicationId === input.publicationId);
  if (!found) throw new NotFound();
  const { publicationId: _id, term, rankShown, publishedAt, ...card } = found;
  return {
    fileName: fileNameOf("report-card", card.studentNumber, term.endDate),
    cards: [{ card, term: { name: term.name, academicYear: term.academicYear }, rankShown, publishedAt }],
  };
}

/**
 * A Class's Report Cards for a Term, or one Student's from them, as the Admin's preview shows
 * them: as Published while they are, and otherwise a draft of the live figures. Admin only.
 */
export async function classReportCardExport(
  ctx: Ctx,
  input: { classId: number; termId?: number; studentId?: string },
): Promise<ReportCardExport> {
  const page = await classReportCards(ctx, { classId: input.classId, termId: input.termId });
  const chosen = input.studentId === undefined ? page.cards : page.cards.filter((c) => c.studentId === input.studentId);
  if (chosen.length === 0) throw new NotFound();
  const { publication } = page;
  const term = publication
    ? { name: publication.termName, academicYear: publication.academicYearName }
    : { name: page.term.name, academicYear: page.term.academicYear };
  return {
    fileName:
      input.studentId === undefined
        ? fileNameOf("report-cards", page.class, page.term.endDate)
        : fileNameOf("report-card", chosen[0].studentNumber, page.term.endDate),
    cards: chosen.map(({ flags: _flags, ...card }) => ({
      card,
      term,
      rankShown: page.rankEnabled,
      publishedAt: publication?.publishedAt ?? null,
    })),
  };
}

/** Names and Student Numbers can hold anything, so only their plain ASCII reaches the header. */
function fileNameOf(kind: string, who: string, termLastDay: string): string {
  const plain = who.replace(/[^A-Za-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${[kind, plain, termLastDay].filter(Boolean).join("-")}.pdf`;
}

// One Student's Published Report Card as a PDF, for that Student and the Admin. The layer
// decides who gets it, whatever the URL names.
import { studentReportCardExport } from "@/core/report-cards/export";
import { asCurrentActor } from "@/web/as-current-actor";
import { pdfResponse, renderPdf } from "@/web/pdf";
import { refusalResponse } from "@/web/refusal";
import { reportCardsHtml } from "../../../../../report-card-document";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; publicationId: string }> }) {
  const { id, publicationId } = await params;
  let exported;
  try {
    exported = await asCurrentActor((ctx) =>
      studentReportCardExport(ctx, { studentId: id, publicationId: Number(publicationId) }),
    );
  } catch (err) {
    return refusalResponse(err);
  }
  return pdfResponse(await renderPdf(reportCardsHtml(exported.cards)), exported.fileName);
}

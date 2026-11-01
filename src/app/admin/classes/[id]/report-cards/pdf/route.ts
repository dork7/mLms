// The Admin's export of a Class's Report Cards as one PDF, or one Student's with ?studentId=.
// Takes ?termId= like the preview.
import { classReportCardExport } from "@/core/report-cards/export";
import { asCurrentActor } from "@/web/as-current-actor";
import { pdfResponse, renderPdf } from "@/web/pdf";
import { refusalResponse } from "@/web/refusal";
import { reportCardsHtml } from "../../../../../report-card-document";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const classId = Number((await params).id);
  const query = new URL(request.url).searchParams;
  const termId = query.get("termId");
  let exported;
  try {
    exported = await asCurrentActor((ctx) =>
      classReportCardExport(ctx, {
        classId,
        termId: termId === null ? undefined : Number(termId),
        studentId: query.get("studentId") ?? undefined,
      }),
    );
  } catch (err) {
    return refusalResponse(err);
  }
  return pdfResponse(await renderPdf(reportCardsHtml(exported.cards)), exported.fileName);
}

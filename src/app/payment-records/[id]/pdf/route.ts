// One Payment Record as a PDF, for the Student it was paid for and the Admin. The layer
// decides who gets it.
import { paymentRecordExport } from "@/core/fees/payment-record-export";
import { asCurrentActor } from "@/web/as-current-actor";
import { pdfResponse, renderPdf } from "@/web/pdf";
import { refusalResponse } from "@/web/refusal";
import { paymentRecordHtml } from "../../../payment-record-document";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let record;
  try {
    record = await asCurrentActor((ctx) => paymentRecordExport(ctx, { paymentRecordId: Number(id) }));
  } catch (err) {
    return refusalResponse(err);
  }
  return pdfResponse(await renderPdf(paymentRecordHtml(record)), record.fileName);
}

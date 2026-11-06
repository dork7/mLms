// Serves a Leave Request's attachment as a download, to whoever the access policy lets see
// the request (the requester and whoever decides it).
import { getLeaveAttachment } from "@/core/leave/leave-requests";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalResponse } from "@/web/refusal";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let attachment;
  try {
    attachment = await asCurrentActor((ctx) => getLeaveAttachment(ctx, { leaveRequestId: Number(id) }));
  } catch (err) {
    return refusalResponse(err);
  }
  if (!attachment) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(attachment.data), {
    headers: {
      "Content-Type": attachment.contentType,
      "Content-Disposition": contentDisposition(attachment.fileName),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** An attachment header that keeps any file name: a plain-ASCII fallback plus the UTF-8 name (RFC 6266). */
function contentDisposition(fileName: string): string {
  const fallback = fileName.replace(/[^\x20-\x7e]|["\\%]/g, "_");
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`;
}

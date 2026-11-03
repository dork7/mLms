// The rules for a Leave Request's attachment (a sick note, a letter). Attachments are stored
// in Postgres (see `leaveAttachment`), so the database backups cover them.
//
// The file's type is read from its first bytes, not from the name or the browser's
// declared type, so what is served back as a PDF or an image really is one.
import { InvalidInput } from "../errors";

export type AttachmentUpload = { fileName: string; data: Uint8Array };
export type Attachment = { fileName: string; contentType: string; data: Uint8Array };

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_FILE_NAME_LENGTH = 200;

const SIGNATURES: { contentType: string; magic: number[] }[] = [
  { contentType: "application/pdf", magic: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // "%PDF-"
  { contentType: "image/jpeg", magic: [0xff, 0xd8, 0xff] },
  { contentType: "image/png", magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
];

/** Checks an upload and works out its content type. Refuses anything but a PDF, JPEG or PNG up to 5 MB. */
export function checkAttachment(upload: AttachmentUpload): Attachment {
  const { data } = upload;
  if (data.byteLength > MAX_ATTACHMENT_BYTES) throw new InvalidInput("errors.leaveAttachmentSize");
  const type = SIGNATURES.find(({ magic }) => magic.every((byte, i) => data[i] === byte));
  if (!type) throw new InvalidInput("errors.leaveAttachmentType");
  return { fileName: cleanFileName(upload.fileName, type.contentType), contentType: type.contentType, data };
}

/** The name to keep: the last path segment, no control characters, at most 200 characters. */
function cleanFileName(name: string, contentType: string): string {
  const base = (name.split(/[/\\]/).pop() ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim();
  const kept = base.slice(-MAX_FILE_NAME_LENGTH);
  return kept || `attachment.${contentType === "application/pdf" ? "pdf" : contentType.slice("image/".length)}`;
}

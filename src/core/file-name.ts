// File names for downloads, built in the layer so they can be tested. Names and Student
// Numbers can hold anything, so only their plain ASCII reaches a Content-Disposition header.

/** ["report-card", "S 1", "2026-12-15"] -> "report-card-S-1-2026-12-15.pdf". Empty parts are dropped. */
export function pdfFileName(...parts: string[]): string {
  const plain = parts.map((p) => p.replace(/[^A-Za-z0-9-]+/g, "-").replace(/^-+|-+$/g, "")).filter(Boolean);
  return `${plain.join("-")}.pdf`;
}

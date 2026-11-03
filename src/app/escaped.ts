// Escaping for documents built as HTML strings (the PDFs), where React can't escape for us.
// Everything from the database goes through this before it reaches the markup.
export function escaped(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// Turning HTML into a PDF with Playwright, and sending it. Server-only. Any PDF the app makes
// goes through here: Report Cards now, Payment Records next.
import "server-only";
import { type Browser, chromium } from "playwright";

// One browser for the whole server, so a rush of downloads opens contexts rather than browsers.
const globalForPdf = globalThis as unknown as { lmsPdfBrowser?: Promise<Browser> };

function sharedBrowser(): Promise<Browser> {
  globalForPdf.lmsPdfBrowser ??= chromium.launch().then(
    (browser) => {
      browser.on("disconnected", () => {
        globalForPdf.lmsPdfBrowser = undefined;
      });
      return browser;
    },
    (err) => {
      globalForPdf.lmsPdfBrowser = undefined;
      throw err;
    },
  );
  return globalForPdf.lmsPdfBrowser;
}

/**
 * Renders a complete HTML document to an A4 PDF. The document must carry its own styles: it
 * loads nothing and runs no script, so what Teachers wrote can't reach the network or the app.
 */
export async function renderPdf(html: string): Promise<Uint8Array> {
  const browser = await sharedBrowser();
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    await context.route("**/*", (route) => route.abort());
    const page = await context.newPage();
    await page.setContent(html);
    return await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "18mm", bottom: "18mm", left: "16mm", right: "16mm" },
    });
  } finally {
    await context.close();
  }
}

/** `fileName` must be plain ASCII with no quotes. */
export function pdfResponse(pdf: Uint8Array, fileName: string): Response {
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

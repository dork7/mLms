// Turns an expected refusal from the application layer into its translation key.
// Anything that isn't a refusal (a bug, a lost database) is rethrown.
import { AccessDenied, NotFound } from "@/core/errors";
import type { MessageKey } from "@/i18n";

export function refusalKey(err: unknown): MessageKey {
  if (err instanceof Error && "messageKey" in err && typeof err.messageKey === "string") {
    return err.messageKey as MessageKey;
  }
  throw err;
}

/** The response for a refusal from the layer. Rethrows anything else, including Next redirects. */
export function refusalResponse(err: unknown): Response {
  if (err instanceof AccessDenied) return new Response(null, { status: 403 });
  if (err instanceof NotFound) return new Response(null, { status: 404 });
  throw err;
}

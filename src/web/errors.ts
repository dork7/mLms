// Maps the application layer's expected refusals to a translation key for the UI.
// Anything else is a bug and is rethrown.
import type { MessageKey } from "@/i18n";

export function messageKeyOf(err: unknown): MessageKey {
  if (err instanceof Error && "messageKey" in err && typeof err.messageKey === "string") {
    return err.messageKey as MessageKey;
  }
  throw err;
}

// Turns an expected refusal from the application layer into its translation key.
// Anything that isn't a refusal (a bug, a lost database) is rethrown.
import type { MessageKey } from "@/i18n";

export function refusalKey(err: unknown): MessageKey {
  if (err instanceof Error && "messageKey" in err && typeof err.messageKey === "string") {
    return err.messageKey as MessageKey;
  }
  throw err;
}

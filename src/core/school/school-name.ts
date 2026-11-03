// The school's name, printed on documents such as the Payment Record PDF. One deployment is
// one school (ADR 0001), so it's set per deployment rather than stored.
import { t } from "@/i18n";

/** The one reader of SCHOOL_NAME. Without it, the app's own name. */
export function schoolName(): string {
  return process.env.SCHOOL_NAME?.trim() || t("app.name");
}

// How an instant reads in the UI, on the school's wall clock. Server components only.
import { schoolTimeZone } from "@/core/clock";
import { locale } from "@/i18n";

export function whenText(instant: Date): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: schoolTimeZone(),
  }).format(instant);
}

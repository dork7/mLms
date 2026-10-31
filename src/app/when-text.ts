// How an instant reads in the UI, on the school's wall clock. Server components only.
import { locale } from "@/i18n";

export function whenText(instant: Date): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: process.env.SCHOOL_TIME_ZONE ?? "Asia/Dubai",
  }).format(instant);
}

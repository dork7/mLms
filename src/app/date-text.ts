// How a calendar date ("YYYY-MM-DD") reads in the UI and documents: "Nov 10, 2141" in
// English, the same style `whenText` gives an instant. A date has no time zone, so it's
// formatted as UTC midnight. Plain, so server and client components can both use it.
import { locale } from "@/i18n";

const format = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" });

export function dateText(date: string): string {
  return format.format(new Date(`${date}T00:00:00Z`));
}

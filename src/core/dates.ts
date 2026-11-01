// Calendar dates are YYYY-MM-DD strings (Postgres `date`, mode "string").

/** A real YYYY-MM-DD calendar date (so not 2026-02-30). */
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(y, m - 1, d));
  return parsed.getUTCFullYear() === y && parsed.getUTCMonth() === m - 1 && parsed.getUTCDate() === d;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "2027-01-01" -> "2026-12-31". */
export function dayBefore(date: string): string {
  return addDays(date, -1);
}

/** "2026-12-31" -> "2027-01-01". */
export function nextDay(date: string): string {
  return addDays(date, 1);
}

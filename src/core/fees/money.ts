// Money is held as whole fils (AED × 100) everywhere: in the database, in the layer and
// in what queries return. Only the edges convert: `parseAed` reads what an Admin types,
// and `formatAed` writes what a person reads.
import { locale } from "@/i18n";

/** The most one Fee or Payment Record may be: AED 10,000,000, well inside a Postgres integer. */
const MAX_FILS = 1_000_000_000;

/**
 * "12,500.50" -> 1250050 fils. Accepts digits with optional thousands commas and up to
 * two decimals. Returns null for anything else, and for zero or more than the maximum.
 */
export function parseAed(text: string): number | null {
  const match = /^(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/.exec(text.trim());
  if (!match) return null;
  const fils = Number(match[1].replaceAll(",", "")) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  if (fils <= 0 || fils > MAX_FILS) return null;
  return fils;
}

/** 1250050 -> "AED 12,500.50" (with a no-break space, so it never wraps apart). */
export function formatAed(fils: number): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "AED" }).format(fils / 100);
}

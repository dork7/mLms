// Pure rules about Mark values: what a valid Mark is, its percentage and an
// Assessment's statistics. Percentages are always worked out from the current
// maximum, never stored, so changing the maximum keeps the raw Marks.
import { InvalidInput } from "../errors";

/** A raw score, a status, or null for "not entered yet". */
export type MarkValue = number | "absent" | "exempt" | null;

export type MarkStats = {
  /** Marks that count: scores and Absent (as zero). Exempt and missing Marks are left out. */
  counted: number;
  average: number | null;
  highest: number | null;
  lowest: number | null;
};

export function toValue(m: { score: number | null; status: "absent" | "exempt" | null }): MarkValue {
  return m.status ?? m.score;
}

/** Refuses a Mark that is neither a status nor a score from 0 to `maxMarks` (two decimals at most). */
export function requireValidMark(value: MarkValue, maxMarks: number): void {
  if (value === null || value === "absent" || value === "exempt") return;
  if (typeof value !== "number") throw new InvalidInput("errors.markInvalid");
  if (!Number.isFinite(value) || value < 0 || value > maxMarks || !hasAtMostTwoDecimals(value)) {
    throw new InvalidInput("errors.markOutOfRange");
  }
}

export function hasAtMostTwoDecimals(value: number): boolean {
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
}

/** The Mark as a percentage of the maximum, to one decimal (Absent = 0); null if Exempt or not entered. */
export function percentOf(value: MarkValue, maxMarks: number): number | null {
  if (value === null || value === "exempt") return null;
  const score = value === "absent" ? 0 : value;
  return Math.round((score / maxMarks) * 1000) / 10;
}

/** Average (to two decimals), highest and lowest raw Marks of the Marks that count. */
export function markStats(values: MarkValue[]): MarkStats {
  const counted = values.flatMap((v) => (v === "absent" ? [0] : typeof v === "number" ? [v] : []));
  if (counted.length === 0) return { counted: 0, average: null, highest: null, lowest: null };
  const sum = counted.reduce((a, b) => a + b, 0);
  return {
    counted: counted.length,
    average: Math.round((sum / counted.length) * 100) / 100,
    highest: Math.max(...counted),
    lowest: Math.min(...counted),
  };
}

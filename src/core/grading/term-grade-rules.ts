// Pure rules for Term Grades: the weighted average, and reading a percentage on a
// Grading Scale. Nothing here touches the database.
import type { MarkValue } from "../assessments/mark-values";

export type GradingBand = { minPercent: number; label: string };

/** Bands are highest first when read from the layer. */
export type GradingScale = { passMark: number; bands: GradingBand[] };

export type TermGradeFigures = {
  /** To two decimals; null if no Assessment counts yet. */
  percent: number | null;
  /** Assessments that count: scores and Absent (as zero). */
  counted: number;
  /** Exempt Marks, left out along with their weight. */
  exempt: number;
  /** Assessments with no Mark entered yet: left out until one is. */
  missing: number;
};

/** Σ(weight × score ÷ maximum) ÷ Σ(weight of the Assessments that count), as a percentage. */
export function termGradeFigures(entries: { weight: number; maxMarks: number; mark: MarkValue }[]): TermGradeFigures {
  let earned = 0;
  let weights = 0;
  let counted = 0;
  let exempt = 0;
  let missing = 0;
  for (const { weight, maxMarks, mark } of entries) {
    if (mark === null) missing += 1;
    else if (mark === "exempt") exempt += 1;
    else {
      earned += (weight * (mark === "absent" ? 0 : mark)) / maxMarks;
      weights += weight;
      counted += 1;
    }
  }
  const percent = counted === 0 ? null : Math.round((earned / weights) * 10000) / 100;
  return { percent, counted, exempt, missing };
}

export type ScaleReading = { label: string | null; passed: boolean | null };

/**
 * Reads a percentage on a Grading Scale: the highest band it reaches, and whether it
 * reaches the pass mark. It reads the rounded percentage, so what is shown and what
 * it earns can never disagree. No percentage or no Scale reads as nothing.
 */
export function readOnScale(percent: number | null, scale: GradingScale | null): ScaleReading {
  if (percent === null || scale === null) return { label: null, passed: null };
  const band = scale.bands.find((b) => percent >= b.minPercent);
  return { label: band?.label ?? null, passed: percent >= scale.passMark };
}

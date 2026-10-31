// Pure rules for Report Cards: the overall percentage, rank and what's still missing.
// Nothing here touches the database.

/**
 * The plain average of the Term Grade percentages, to two decimals, skipping a Term Grade
 * with no percentage. It averages the rounded figures on the card, so the card adds up,
 * and sums whole hundredths so 1.005 can't round down through floating point.
 */
export function overallPercentOf(grades: { percent: number | null }[]): number | null {
  const shown = grades.flatMap((g) => (g.percent === null ? [] : [Math.round(g.percent * 100)]));
  if (shown.length === 0) return null;
  return Math.round(shown.reduce((sum, hundredths) => sum + hundredths, 0) / shown.length) / 100;
}

/**
 * Each Student's rank by overall percentage, highest first. Tied Students share a rank,
 * and the next rank skips past them (90, 90, 70 rank 1, 1, 3). A Student with no overall
 * percentage has no rank and takes no place.
 */
export function ranksOf(cards: { studentId: string; overallPercent: number | null }[]): Map<string, number> {
  const percents = cards.flatMap((c) => (c.overallPercent === null ? [] : [c.overallPercent]));
  const ranks = new Map<string, number>();
  for (const { studentId, overallPercent } of cards) {
    if (overallPercent !== null) ranks.set(studentId, 1 + percents.filter((p) => p > overallPercent).length);
  }
  return ranks;
}

export type ReportCardFlag =
  /** Assessments in the Term Grade with no Mark entered yet. */
  | { kind: "missingMarks"; subject: string; count: number }
  /** A Subject on the card with no Assessment in the Term for this Student. */
  | { kind: "noAssessments"; subject: string }
  | { kind: "missingRemark"; subject: string; teacher: string }
  | { kind: "missingOverallRemark"; teacher: string };

/** What the Admin should chase on one Report Card, Subject by Subject, then the overall remark. */
export function flagsOf(card: {
  grades: { subject: string; counted: number; exempt: number; missing: number; teacher: string; remark: string | null }[];
  overallRemark: string | null;
  classTeacher: string;
}): ReportCardFlag[] {
  const flags: ReportCardFlag[] = [];
  for (const { subject, counted, exempt, missing, teacher, remark } of card.grades) {
    if (missing > 0) flags.push({ kind: "missingMarks", subject, count: missing });
    else if (counted + exempt === 0) flags.push({ kind: "noAssessments", subject });
    if (remark === null) flags.push({ kind: "missingRemark", subject, teacher });
  }
  if (card.overallRemark === null) flags.push({ kind: "missingOverallRemark", teacher: card.classTeacher });
  return flags;
}

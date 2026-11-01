// How a Mark and an Assessment's statistics read in the UI.
import type { MarkStats, MarkValue } from "@/core/assessments/mark-values";
import { t } from "@/i18n";

export function markText(mark: MarkValue, maxMarks: number, percent: number | null): string {
  if (mark === null) return t("marks.notEntered");
  if (mark === "absent") return t("marks.absent");
  if (mark === "exempt") return t("marks.exempt");
  return t("marks.outOf", { score: mark, max: maxMarks, percent: percent ?? 0 });
}

export function statsText(stats: MarkStats): string {
  if (stats.counted === 0) return t("assessments.noStats");
  return t("assessments.stats", {
    average: stats.average!,
    highest: stats.highest!,
    lowest: stats.lowest!,
    counted: stats.counted,
  });
}

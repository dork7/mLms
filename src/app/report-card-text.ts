// How a Report Card's figures and flags read in the UI.
import type { ReportCardFlag } from "@/core/report-cards/report-card-rules";
import { t } from "@/i18n";

export function overallText(percent: number | null): string {
  return percent === null ? t("reportCards.noOverall") : t("reportCards.overall", { percent });
}

export function flagText(flag: ReportCardFlag): string {
  switch (flag.kind) {
    case "missingMarks":
      return t("reportCards.flagMissingMarks", { subject: flag.subject, count: flag.count });
    case "noAssessments":
      return t("reportCards.flagNoAssessments", { subject: flag.subject });
    case "missingRemark":
      return t("reportCards.flagMissingRemark", { subject: flag.subject, teacher: flag.teacher });
    case "missingOverallRemark":
      return t("reportCards.flagMissingOverallRemark", { teacher: flag.teacher });
  }
}

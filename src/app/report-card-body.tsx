// What a Report Card says: the overall percentage, rank if it's shown, each Term Grade with
// its remark, and the overall remark. The Admin's preview and the Student's view share it.
import type { PublishedCard } from "@/core/report-cards/report-cards";
import { t } from "@/i18n";
import { overallText } from "./report-card-text";
import { termGradeNotes, termGradeText } from "./term-grade-text";

export function ReportCardBody({ card, rankShown }: { card: PublishedCard; rankShown: boolean }) {
  return (
    <>
      <p>
        <strong>{overallText(card.overallPercent)}</strong>
        {rankShown && (
          <>
            {t("common.separator")}
            <strong>{card.rank === null ? t("reportCards.noRank") : t("reportCards.rank", { rank: card.rank })}</strong>
          </>
        )}
      </p>
      <ul className="list">
        {card.grades.map((grade) => (
          <li key={grade.subjectId}>
            <div className="list-item">
              <span>{grade.subject}</span>
              <strong>{termGradeText(grade)}</strong>
            </div>
            {termGradeNotes(grade) && <div className="muted">{termGradeNotes(grade)}</div>}
            <div className="muted remark">
              {grade.remark === null
                ? t("reportCards.remarkNone")
                : t("reportCards.remarkFrom", { teacher: grade.teacher, remark: grade.remark })}
            </div>
          </li>
        ))}
      </ul>
      <h3>{t("reportCards.overallRemarkHeading")}</h3>
      <p className="remark">
        {card.overallRemark === null
          ? t("reportCards.remarkNone")
          : t("reportCards.remarkFrom", { teacher: card.classTeacher, remark: card.overallRemark })}
      </p>
    </>
  );
}

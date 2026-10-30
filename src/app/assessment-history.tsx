// A Student's Assessment history, newest first. The layer has already left out
// whatever the viewer may not see.
import type { HistoryRow } from "@/core/assessments/marks";
import { t } from "@/i18n";
import { markText } from "./mark-text";

export function AssessmentHistory({ rows }: { rows: HistoryRow[] }) {
  return (
    <section className="card" aria-labelledby="assessment-history">
      <h2 id="assessment-history">{t("marks.historyTitle")}</h2>
      {rows.length === 0 ? (
        <p>{t("marks.historyNone")}</p>
      ) : (
        <ul className="list">
          {rows.map((r) => (
            <li key={r.assessmentId} className="list-item">
              <div>
                {t("marks.historyLine", {
                  subject: r.subject,
                  class: r.class,
                  type: t(`assessments.types.${r.type}`),
                  date: r.date,
                  term: r.term ?? t("assessments.noTerm"),
                })}
              </div>
              <strong>{markText(r.mark, r.maxMarks, r.percent)}</strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// A Student's Assessment history, newest first. The layer has already left out
// whatever the viewer may not see. The Student dashboard shows the latest of it under
// its own title.
import type { HistoryRow } from "@/core/assessments/marks";
import { t } from "@/i18n";
import { markText } from "./mark-text";

export function AssessmentHistory({
  rows,
  title = t("marks.historyTitle"),
  none = t("marks.historyNone"),
}: {
  rows: HistoryRow[];
  title?: string;
  none?: string;
}) {
  return (
    <section className="card" aria-labelledby="assessment-history">
      <h2 id="assessment-history">{title}</h2>
      {rows.length === 0 ? (
        <p>{none}</p>
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

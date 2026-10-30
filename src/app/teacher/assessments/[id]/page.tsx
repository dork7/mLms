// One Assessment: its details, statistics and marks grid. The grid lists the Class's
// roster on the Assessment's date (as the layer decides). Only the Subject Teacher
// gets the editable grid and the maximum/weight form; the layer says who that is.
import Link from "next/link";
import { marksGrid } from "@/core/assessments/marks";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import { markText, statsText } from "../../../mark-text";
import { EditAssessmentForm, MarksGridForm } from "../forms";

export default async function AssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const assessmentId = Number((await params).id);
  let grid;
  try {
    grid = await asCurrentActor((ctx) => marksGrid(ctx, { assessmentId }));
  } catch (err) {
    return (
      <main className="page">
        <p className="error">{t(refusalKey(err))}</p>
        <Link href="/teacher">{t("nav.dashboard")}</Link>
      </main>
    );
  }
  const a = grid.assessment;
  const type = t(`assessments.types.${a.type}`);

  return (
    <main className="page">
      <header className="topbar">
        <h1>{t("assessments.heading", { type, date: a.date })}</h1>
        <Link href={`/teacher/class-subjects/${a.classSubjectId}`}>
          {t("assessments.backToClassSubject", { subject: a.subject, class: a.class })}
        </Link>
      </header>
      <section className="card">
        <p>
          {t("assessments.details", {
            subject: a.subject,
            class: a.class,
            term: a.term ?? t("assessments.noTerm"),
            max: a.maxMarks,
            weight: a.weight,
          })}
        </p>
        <p>{statsText(grid.stats)}</p>
      </section>
      <section className="card" aria-labelledby="marks">
        <h2 id="marks">{t("marks.gridTitle")}</h2>
        <p className="muted">{t("marks.gridHint", { class: a.class, date: a.date, max: a.maxMarks })}</p>
        {grid.rows.length === 0 ? (
          <p>{t("marks.empty")}</p>
        ) : grid.canEnterMarks ? (
          <MarksGridForm
            key={`${a.maxMarks}`}
            assessmentId={a.id}
            maxMarks={a.maxMarks}
            rows={grid.rows.map(({ studentId, name, studentNumber, mark }) => ({ studentId, name, studentNumber, mark }))}
          />
        ) : (
          <ul className="list">
            {grid.rows.map((r) => (
              <li key={r.studentId} className="list-item">
                <Link href={`/teacher/students/${r.studentId}/marks`}>{r.name}</Link>{" "}
                <span className="muted">{r.studentNumber}</span>: {markText(r.mark, a.maxMarks, r.percent)}
              </li>
            ))}
          </ul>
        )}
      </section>
      {grid.canEnterMarks && (
        <section className="card" aria-labelledby="edit-assessment">
          <h2 id="edit-assessment">{t("assessments.editTitle")}</h2>
          <EditAssessmentForm assessmentId={a.id} maxMarks={a.maxMarks} weight={a.weight} />
        </section>
      )}
    </main>
  );
}

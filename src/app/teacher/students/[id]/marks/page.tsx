// A Student's Term Grades and Assessment history for a Teacher. Unlike the profile,
// access comes from the Class Subjects: a Teacher of a Class the Student was in still
// sees those Marks after the Student moves (the layer decides).
import Link from "next/link";
import { studentAssessmentHistory } from "@/core/assessments/marks";
import { studentTermGrades } from "@/core/grading/term-grades";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import { AssessmentHistory } from "../../../../assessment-history";
import { TermGrades } from "../../../../term-grades";

export default async function StudentMarksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let data;
  try {
    data = await asCurrentActor((ctx) =>
      Promise.all([studentTermGrades(ctx, { studentId: id }), studentAssessmentHistory(ctx, { studentId: id })]),
    );
  } catch (err) {
    return (
      <main className="page">
        <p className="error">{t(refusalKey(err))}</p>
        <Link href="/teacher">{t("nav.dashboard")}</Link>
      </main>
    );
  }
  const [termGrades, rows] = data;

  return (
    <main className="page">
      <header className="topbar">
        <h1>{t("marks.historyTitle")}</h1>
        <Link href="/teacher">{t("nav.dashboard")}</Link>
      </header>
      <TermGrades terms={termGrades} />
      <AssessmentHistory rows={rows} />
    </main>
  );
}

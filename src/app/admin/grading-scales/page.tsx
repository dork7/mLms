// The Admin's Grading Scales: one form per Grade.
import Link from "next/link";
import { listGradingScales } from "@/core/grading/grading-scales";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import { GradingScaleForm } from "./grading-scale-form";

export default async function GradingScalesPage() {
  let grades;
  try {
    grades = await asCurrentActor((ctx) => listGradingScales(ctx));
  } catch (err) {
    return (
      <main className="page">
        <p className="error">{t(refusalKey(err))}</p>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="topbar">
        <h1>{t("gradingScales.title")}</h1>
        <Link href="/admin">{t("setup.backToDashboard")}</Link>
      </header>
      <p className="muted">{t("gradingScales.hint")}</p>
      {grades.length === 0 && (
        <section className="card">
          <p>{t("gradingScales.noGrades")}</p>
        </section>
      )}
      {grades.map((g) => (
        <section className="card" key={g.gradeId} aria-labelledby={`grade-${g.gradeId}`}>
          <h2 id={`grade-${g.gradeId}`}>{g.grade}</h2>
          <GradingScaleForm gradeId={g.gradeId} grade={g.grade} scale={g.scale} />
        </section>
      ))}
    </main>
  );
}

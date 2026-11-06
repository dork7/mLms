// How a Term Grade reads in the UI: "60%, B, Pass", and what's left out of it.
import type { TermGrade } from "@/core/grading/term-grades";
import { t } from "@/i18n";

export function termGradeText(grade: TermGrade): string {
  if (grade.percent === null) return t("termGrades.noPercent");
  const parts = [t("termGrades.percent", { percent: grade.percent })];
  if (grade.label !== null) parts.push(grade.label);
  if (grade.passed !== null) parts.push(t(grade.passed ? "termGrades.pass" : "termGrades.fail"));
  return parts.join(", ");
}

/** What the figure leaves out, so a partial Term Grade doesn't read as a final one. */
export function termGradeNotes(grade: TermGrade): string {
  const notes = [];
  if (grade.missing > 0) notes.push(t("termGrades.missing", { count: grade.missing }));
  if (grade.exempt > 0) notes.push(t("termGrades.exempt", { count: grade.exempt }));
  return notes.join(", ");
}

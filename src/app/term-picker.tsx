// A GET form that reopens the page on another Term of the year.
import type { TermRef } from "@/core/grading/term-grades";
import { t } from "@/i18n";

export function TermPicker({ terms, termId }: { terms: TermRef[]; termId: number }) {
  return (
    <form method="get" className="inline-form">
      <label className="field">
        {t("termGrades.term")}
        <select name="termId" defaultValue={termId}>
          {terms.map((term) => (
            <option key={term.id} value={term.id}>
              {term.name}
            </option>
          ))}
        </select>
      </label>
      <button className="button" type="submit">
        {t("termGrades.show")}
      </button>
    </form>
  );
}

/** A `termId` from the URL: absent or empty means "let the layer choose". */
export function termIdFrom(value: string | string[] | undefined): number | undefined {
  return typeof value === "string" && value !== "" ? Number(value) : undefined;
}

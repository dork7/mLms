"use client";
// Create or edit an Academic Year with its Terms. Inputs are controlled so the
// entered values survive a refusal (React resets uncontrolled forms after an action).
import { useActionState, useState } from "react";
import type { AcademicYear } from "@/core/school/academic-year";
import { t } from "@/i18n";
import type { FormState } from "@/app/form-kit";
import { saveAcademicYear } from "../setup-actions";

type TermRow = { name: string; startDate: string; endDate: string };

const blankYear = { name: "", startDate: "", endDate: "" };
const blankTerms = (): TermRow[] => [{ name: "", startDate: "", endDate: "" }];

export function AcademicYearForm({ year }: { year?: AcademicYear }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveAcademicYear, { saved: 0 });
  const [fields, setFields] = useState(
    year ? { name: year.name, startDate: year.startDate, endDate: year.endDate } : blankYear,
  );
  const [terms, setTerms] = useState<TermRow[]>(
    year ? year.terms.map(({ name, startDate, endDate }) => ({ name, startDate, endDate })) : blankTerms(),
  );
  const [seen, setSeen] = useState(0);
  if (state.saved !== seen) {
    setSeen(state.saved);
    if (!year) {
      setFields(blankYear);
      setTerms(blankTerms());
    }
  }

  const setTerm = (i: number, key: keyof TermRow, value: string) =>
    setTerms((rows) => rows.map((row, j) => (j === i ? { ...row, [key]: value } : row)));

  return (
    <form action={action}>
      {state.error && (
        <p className="error" role="alert">
          {t(state.error)}
        </p>
      )}
      {year && <input type="hidden" name="id" value={year.id} />}
      <label className="field">
        {t("setup.academicYears.name")}
        <input
          name="name"
          value={fields.name}
          onChange={(e) => setFields({ ...fields, name: e.target.value })}
          required
        />
      </label>
      <div className="row">
        <label className="field">
          {t("setup.academicYears.startDate")}
          <input
            name="startDate"
            type="date"
            value={fields.startDate}
            onChange={(e) => setFields({ ...fields, startDate: e.target.value })}
            required
          />
        </label>
        <label className="field">
          {t("setup.academicYears.endDate")}
          <input
            name="endDate"
            type="date"
            value={fields.endDate}
            onChange={(e) => setFields({ ...fields, endDate: e.target.value })}
            required
          />
        </label>
      </div>

      <fieldset className="terms">
        <legend>{t("setup.academicYears.terms")}</legend>
        {terms.map((row, i) => (
          <div className="row" key={i}>
            <label className="field">
              {t("setup.academicYears.termName", { n: i + 1 })}
              <input name="termName" value={row.name} onChange={(e) => setTerm(i, "name", e.target.value)} required />
            </label>
            <label className="field">
              {t("setup.academicYears.termStart", { n: i + 1 })}
              <input
                name="termStart"
                type="date"
                value={row.startDate}
                onChange={(e) => setTerm(i, "startDate", e.target.value)}
                required
              />
            </label>
            <label className="field">
              {t("setup.academicYears.termEnd", { n: i + 1 })}
              <input
                name="termEnd"
                type="date"
                value={row.endDate}
                onChange={(e) => setTerm(i, "endDate", e.target.value)}
                required
              />
            </label>
            {terms.length > 1 && (
              <button
                className="button-link"
                type="button"
                onClick={() => setTerms((rows) => rows.filter((_, j) => j !== i))}
              >
                {t("setup.academicYears.removeTerm", { n: i + 1 })}
              </button>
            )}
          </div>
        ))}
        <button
          className="button-link"
          type="button"
          onClick={() => setTerms((rows) => [...rows, { name: "", startDate: "", endDate: "" }])}
        >
          {t("setup.academicYears.addTerm")}
        </button>
      </fieldset>

      <button className="button" type="submit" disabled={pending}>
        {t(year ? "setup.save" : "setup.academicYears.create")}
      </button>
    </form>
  );
}

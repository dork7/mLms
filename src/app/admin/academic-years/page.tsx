import type { Metadata } from "next";
import Link from "next/link";
import { dateText } from "@/app/date-text";
import { t } from "@/i18n";
import { SetupPage } from "../setup-shell";
import { AcademicYearForm } from "./academic-year-form";

export const metadata: Metadata = { title: t("pageTitles.academicYears") };

export default function AcademicYearsPage() {
  return (
    <SetupPage title="setup.academicYears.title">
      {(setup) => (
        <>
          <section className="card">
            {setup.academicYears.length === 0 ? (
              <p>{t("setup.academicYears.empty")}</p>
            ) : (
              <ul className="list">
                {setup.academicYears.map((year) => (
                  <li key={year.id}>
                    <h2>
                      {year.name}{" "}
                      {year.closed ? (
                        <span className="muted">{t("yearEnd.closed")}</span>
                      ) : (
                        <Link href={`/admin/academic-years/${year.id}`}>
                          {t("setup.academicYears.edit", { name: year.name })}
                        </Link>
                      )}
                    </h2>
                    <p>{t("setup.dateRange", { start: dateText(year.startDate), end: dateText(year.endDate) })}</p>
                    <ul>
                      {year.terms.map((term) => (
                        <li key={term.id}>
                          {t("setup.academicYears.termLine", {
                            name: term.name,
                            start: dateText(term.startDate),
                            end: dateText(term.endDate),
                          })}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="card">
            <h2>{t("setup.academicYears.new")}</h2>
            <AcademicYearForm />
          </section>
        </>
      )}
    </SetupPage>
  );
}

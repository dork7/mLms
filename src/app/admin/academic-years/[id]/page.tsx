import type { Metadata } from "next";
import { t } from "@/i18n";
import { SetupPage } from "../../setup-shell";
import { AcademicYearForm } from "../academic-year-form";

export const metadata: Metadata = { title: t("pageTitles.academicYear") };

export default async function EditAcademicYearPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <SetupPage title="setup.academicYears.editTitle">
      {(setup) => {
        const year = setup.academicYears.find((y) => y.id === Number(id));
        return (
          <section className="card">
            {!year ? (
              <p className="error">{t("errors.notFound")}</p>
            ) : year.closed ? (
              <p>{t("yearEnd.closedNotice")}</p>
            ) : (
              <AcademicYearForm year={year} />
            )}
          </section>
        );
      }}
    </SetupPage>
  );
}

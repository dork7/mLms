import { t } from "@/i18n";
import { SetupPage } from "../../setup-shell";
import { AcademicYearForm } from "../academic-year-form";

export default async function EditAcademicYearPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <SetupPage title="setup.academicYears.editTitle">
      {(setup) => {
        const year = setup.academicYears.find((y) => y.id === Number(id));
        return (
          <section className="card">
            {year ? <AcademicYearForm year={year} /> : <p className="error">{t("errors.notFound")}</p>}
          </section>
        );
      }}
    </SetupPage>
  );
}

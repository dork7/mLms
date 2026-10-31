// Promotion for one Class: its Students still enrolled, each Promoted, Repeating or Leaving.
import Link from "next/link";
import { promotionForm } from "@/core/year-end/year-end";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import { PromotionForm } from "../../forms";

export default async function PromoteClassPage({ params }: { params: Promise<{ id: string }> }) {
  const classId = Number((await params).id);
  let form;
  try {
    form = await asCurrentActor((ctx) => promotionForm(ctx, { classId }));
  } catch (err) {
    return (
      <main className="page">
        <p className="error">{t(refusalKey(err))}</p>
        <Link href="/admin/year-end">{t("yearEnd.backToYearEnd")}</Link>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="topbar">
        <h1>{t("yearEnd.promoteTitle", { name: form.class.name })}</h1>
        <Link href="/admin/year-end">{t("yearEnd.backToYearEnd")}</Link>
      </header>
      <section className="card">
        {!form.nextYear ? (
          <p>{t("yearEnd.noNextYear")}</p>
        ) : (
          <>
            <p>{t("yearEnd.summary", { grade: form.class.grade, year: form.class.academicYear, next: form.nextYear })}</p>
            {form.students.length === 0 ? (
              <p>{t("yearEnd.noStudents")}</p>
            ) : (
              <PromotionForm
                classId={classId}
                students={form.students}
                targets={form.targets}
                repeatTargets={form.repeatTargets}
                firstDay={form.class.startDate}
                lastDay={form.class.endDate}
              />
            )}
          </>
        )}
      </section>
    </main>
  );
}

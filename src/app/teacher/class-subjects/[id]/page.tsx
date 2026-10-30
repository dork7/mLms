// One Class Subject, for its Subject Teacher or its Class's Class Teacher.
// Later tickets add its Lessons and Assessments here.
import Link from "next/link";
import { getClassSubject } from "@/core/classes/class-subjects";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";

export default async function ClassSubjectPage({ params }: { params: Promise<{ id: string }> }) {
  const classSubjectId = Number((await params).id);
  let cs;
  try {
    cs = await asCurrentActor((ctx) => getClassSubject(ctx, { classSubjectId }));
  } catch (err) {
    return (
      <main className="page">
        <p className="error">{t(refusalKey(err))}</p>
        <Link href="/teacher">{t("nav.dashboard")}</Link>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="topbar">
        <h1>{t("classSubject.title", { subject: cs.subject, class: cs.class })}</h1>
        <Link href="/teacher">{t("nav.dashboard")}</Link>
      </header>
      <section className="card">
        <p>{t("classSubject.details", { grade: cs.grade, year: cs.academicYear, teacher: cs.teacher })}</p>
      </section>
    </main>
  );
}

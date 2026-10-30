// The class summary of Lessons, shared by the Admin's and the Class Teacher's routes.
// The layer decides who may see it (the Admin, or this Class's Class Teacher).
import Link from "next/link";
import { getClass } from "@/core/classes/classes";
import { listClassLessons } from "@/core/lessons/lessons";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import { LessonList } from "./lesson-list";

export async function ClassLessonsPage({ classId, classHref }: { classId: number; classHref: string }) {
  let data;
  try {
    data = await asCurrentActor((ctx) => Promise.all([getClass(ctx, { classId }), listClassLessons(ctx, { classId })]));
  } catch (err) {
    return (
      <main className="page">
        <p className="error">{t(refusalKey(err))}</p>
      </main>
    );
  }
  const [schoolClass, lessons] = data;

  return (
    <main className="page">
      <header className="topbar">
        <h1>{t("lessons.summaryTitle", { class: schoolClass.name })}</h1>
        <Link href={classHref}>{t("lessons.backToClass", { class: schoolClass.name })}</Link>
      </header>
      <section className="card">
        <LessonList lessons={lessons} />
      </section>
    </main>
  );
}

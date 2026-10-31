// The Admin's Classes: every Class with its Grade, Academic Year and Class Teacher,
// plus a form to add one. Each Class links to its Class Subjects.
import Link from "next/link";
import { listTeachers } from "@/core/accounts/list-teachers";
import { listClasses } from "@/core/classes/classes";
import { getSchoolSetup } from "@/core/school/school-setup";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import { AddClassForm } from "./forms";

export default async function ClassesPage() {
  let data;
  try {
    data = await asCurrentActor((ctx) => Promise.all([listClasses(ctx), getSchoolSetup(ctx), listTeachers(ctx)]));
  } catch (err) {
    return (
      <main className="page">
        <p className="error">{t(refusalKey(err))}</p>
      </main>
    );
  }
  const [classes, setup, allTeachers] = data;
  const teachers = allTeachers.filter((teacher) => !teacher.disabled);
  const openYears = setup.academicYears.filter((year) => !year.closed);
  const ready = openYears.length > 0 && setup.grades.length > 0 && teachers.length > 0;

  return (
    <main className="page">
      <header className="topbar">
        <h1>{t("classes.title")}</h1>
        <Link href="/admin">{t("nav.dashboard")}</Link>
      </header>
      <section className="card">
        {classes.length === 0 ? (
          <p>{t("classes.empty")}</p>
        ) : (
          <ul className="list">
            {classes.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/classes/${c.id}`}>{c.name}</Link>
                <div className="muted">
                  {t("classes.summary", { grade: c.grade, year: c.academicYear, teacher: c.classTeacher })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card">
        <h2>{t("classes.addTitle")}</h2>
        {ready ? (
          <AddClassForm academicYears={openYears} grades={setup.grades} teachers={teachers} />
        ) : (
          <p>{t("classes.needsSetup")}</p>
        )}
      </section>
    </main>
  );
}

// A Teacher's "My Students": today's Students of the Classes they teach, filtered by
// Class and Class Subject through a plain GET form.
import Link from "next/link";
import { listMyClassSubjects } from "@/core/classes/class-subjects";
import { listMyClasses } from "@/core/classes/classes";
import { listMyStudents } from "@/core/enrollment/my-students";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";

export default async function MyStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string; classSubjectId?: string }>;
}) {
  const { classId = "", classSubjectId = "" } = await searchParams;
  const filter = {
    classId: classId ? Number(classId) : undefined,
    classSubjectId: classSubjectId ? Number(classSubjectId) : undefined,
  };
  let data;
  try {
    data = await asCurrentActor((ctx) =>
      Promise.all([listMyStudents(ctx, filter), listMyClassSubjects(ctx), listMyClasses(ctx)]),
    );
  } catch (err) {
    return (
      <main className="page">
        <p className="error">{t(refusalKey(err))}</p>
        <Link href="/teacher">{t("nav.dashboard")}</Link>
      </main>
    );
  }
  const [students, classSubjects, classTeacherOf] = data;
  // The Classes to filter by: those of the Teacher's Class Subjects and those they are Class Teacher of.
  const classes = new Map<number, string>();
  for (const cs of classSubjects) classes.set(cs.classId, cs.class);
  for (const c of classTeacherOf) classes.set(c.id, c.name);

  return (
    <main className="page">
      <header className="topbar">
        <h1>{t("myStudents.title")}</h1>
        <Link href="/teacher">{t("nav.dashboard")}</Link>
      </header>
      <section className="card">
        <form method="get" className="inline-form">
          <label className="field">
            {t("myStudents.filterClass")}
            <select name="classId" defaultValue={classId}>
              <option value="">{t("myStudents.all")}</option>
              {[...classes].map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            {t("myStudents.filterClassSubject")}
            <select name="classSubjectId" defaultValue={classSubjectId}>
              <option value="">{t("myStudents.all")}</option>
              {classSubjects.map((cs) => (
                <option key={cs.id} value={cs.id}>
                  {t("classSubject.title", { subject: cs.subject, class: cs.class })}
                </option>
              ))}
            </select>
          </label>
          <button className="button" type="submit">
            {t("myStudents.filter")}
          </button>
        </form>
        {students.length === 0 ? (
          <p>{t("myStudents.empty")}</p>
        ) : (
          <ul className="list" aria-label={t("myStudents.title")}>
            {students.map((s) => (
              <li key={s.studentId}>
                <Link href={`/teacher/students/${s.studentId}`}>
                  {t("myStudents.line", { name: s.name, studentNumber: s.studentNumber, class: s.class })}
                </Link>
                {s.classSubjects.length > 0 && (
                  <div className="muted">{s.classSubjects.map((cs) => cs.subject).join(", ")}</div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

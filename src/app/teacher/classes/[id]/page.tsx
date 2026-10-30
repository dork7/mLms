// A Class for its Class Teacher: every Class Subject of the Class and who teaches it,
// and the Class's roster on a date (today by default).
import Link from "next/link";
import { listClassSubjects } from "@/core/classes/class-subjects";
import { getClass } from "@/core/classes/classes";
import { classRoster } from "@/core/enrollment/enrollment";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import { ClassRoster } from "../../../class-roster";

export default async function TeacherClassPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const classId = Number((await params).id);
  const { date = "" } = await searchParams;
  let data;
  try {
    data = await asCurrentActor((ctx) =>
      Promise.all([
        getClass(ctx, { classId }),
        listClassSubjects(ctx, { classId }),
        classRoster(ctx, { classId, date: date || undefined }),
      ]),
    );
  } catch (err) {
    return (
      <main className="page">
        <p className="error">{t(refusalKey(err))}</p>
        <Link href="/teacher">{t("nav.dashboard")}</Link>
      </main>
    );
  }
  const [schoolClass, classSubjects, roster] = data;

  return (
    <main className="page">
      <header className="topbar">
        <h1>{schoolClass.name}</h1>
        <Link href="/teacher">{t("nav.dashboard")}</Link>
      </header>
      <section className="card">
        <p>
          {t("classes.summary", {
            grade: schoolClass.grade,
            year: schoolClass.academicYear,
            teacher: schoolClass.classTeacher,
          })}
        </p>
        <p>
          <Link href={`/teacher/classes/${classId}/lessons`}>{t("lessons.summaryLink")}</Link>
        </p>
        <h2>{t("classes.classSubjects")}</h2>
        {classSubjects.length === 0 ? (
          <p>{t("classes.noClassSubjects")}</p>
        ) : (
          <ul className="list">
            {classSubjects.map((cs) => (
              <li key={cs.id}>
                <Link href={`/teacher/class-subjects/${cs.id}`}>
                  {t("classes.classSubjectLine", { subject: cs.subject, teacher: cs.teacher })}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <ClassRoster roster={roster} date={date} profileHref={(id) => `/teacher/students/${id}`} />
    </main>
  );
}

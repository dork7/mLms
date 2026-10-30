// One Class for the Admin: its Class Subjects, each with a form to reassign the
// Subject Teacher, plus a form to add a Class Subject.
import Link from "next/link";
import { listTeachers } from "@/core/accounts/list-teachers";
import { listClassSubjects } from "@/core/classes/class-subjects";
import { getClass } from "@/core/classes/classes";
import { listSubjects } from "@/core/school/catalogue";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import { AddClassSubjectForm, ReassignTeacherForm } from "../forms";

export default async function ClassPage({ params }: { params: Promise<{ id: string }> }) {
  const classId = Number((await params).id);
  let data;
  try {
    data = await asCurrentActor((ctx) =>
      Promise.all([
        getClass(ctx, { classId }),
        listClassSubjects(ctx, { classId }),
        listSubjects(ctx),
        listTeachers(ctx),
      ]),
    );
  } catch (err) {
    return (
      <main className="page">
        <p className="error">{t(refusalKey(err))}</p>
      </main>
    );
  }
  const [schoolClass, classSubjects, subjects, allTeachers] = data;
  const teachers = allTeachers.filter((teacher) => !teacher.disabled);

  return (
    <main className="page">
      <header className="topbar">
        <h1>{schoolClass.name}</h1>
        <Link href="/admin/classes">{t("classes.backToClasses")}</Link>
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
          <Link href={`/admin/classes/${classId}/lessons`}>{t("lessons.summaryLink")}</Link>
        </p>
        <h2>{t("classes.classSubjects")}</h2>
        {classSubjects.length === 0 ? (
          <p>{t("classes.noClassSubjects")}</p>
        ) : (
          <ul className="list">
            {classSubjects.map((cs) => (
              <li key={cs.id}>
                <ReassignTeacherForm
                  classId={classId}
                  classSubjectId={cs.id}
                  subject={cs.subject}
                  teacherId={cs.teacherId}
                  teachers={
                    // Keep a disabled current Subject Teacher selectable so the form shows them.
                    teachers.some((teacher) => teacher.id === cs.teacherId)
                      ? teachers
                      : [{ id: cs.teacherId, name: cs.teacher }, ...teachers]
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card">
        <h2>{t("classes.addClassSubjectTitle")}</h2>
        {subjects.length > 0 && teachers.length > 0 ? (
          <AddClassSubjectForm classId={classId} subjects={subjects} teachers={teachers} />
        ) : (
          <p>{t("classes.needsSubjects")}</p>
        )}
      </section>
    </main>
  );
}

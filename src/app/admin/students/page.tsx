import Link from "next/link";
import { AccessDenied } from "@/core/errors";
import { listStudents } from "@/core/students/list-students";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { RegisterStudentForm } from "./register-student-form";

export default async function StudentsPage() {
  let students;
  try {
    students = await asCurrentActor((ctx) => listStudents(ctx));
  } catch (err) {
    if (err instanceof AccessDenied) {
      return (
        <main className="page">
          <p className="error">{t(err.messageKey)}</p>
        </main>
      );
    }
    throw err;
  }

  return (
    <main className="page">
      <header className="topbar">
        <h1>{t("students.title")}</h1>
        <Link href="/admin">{t("nav.dashboard")}</Link>
      </header>
      <section className="card">
        {students.length === 0 ? (
          <p>{t("students.none")}</p>
        ) : (
          <ul className="list">
            {students.map((student) => (
              <li key={student.id} className="list-item">
                <div>
                  <strong>{student.name}</strong>
                  <div className="muted">{student.studentNumber}</div>
                  {student.disabled && <div className="muted">{t("students.disabled")}</div>}
                </div>
                <Link href={`/admin/students/${student.id}`}>{t("students.viewProfile")}</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card">
        <h2>{t("students.registerTitle")}</h2>
        <RegisterStudentForm />
      </section>
    </main>
  );
}

import Link from "next/link";
import { listTeachers } from "@/core/accounts/list-teachers";
import { AccessDenied } from "@/core/errors";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { setLoginEnabled } from "./actions";
import { AddTeacherForm } from "./add-teacher-form";

export default async function TeachersPage() {
  let teachers;
  try {
    teachers = await asCurrentActor((ctx) => listTeachers(ctx));
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
        <h1>{t("teachers.title")}</h1>
        <Link href="/admin">{t("nav.dashboard")}</Link>
      </header>
      <section className="card">
        {teachers.length === 0 ? (
          <p>{t("teachers.none")}</p>
        ) : (
          <ul className="list">
            {teachers.map((teacher) => (
              <li key={teacher.id}>
                <div>
                  <strong>{teacher.name}</strong>
                  <div className="muted">{[teacher.email, teacher.phone].filter(Boolean).join(" · ")}</div>
                  {teacher.disabled && <div className="muted">{t("teachers.disabled")}</div>}
                </div>
                <form action={setLoginEnabled}>
                  <input type="hidden" name="userId" value={teacher.id} />
                  <input type="hidden" name="enable" value={String(teacher.disabled)} />
                  <button className="button-link" type="submit">
                    {teacher.disabled ? t("teachers.enable") : t("teachers.disable")}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card">
        <h2>{t("teachers.addTitle")}</h2>
        <AddTeacherForm />
      </section>
    </main>
  );
}

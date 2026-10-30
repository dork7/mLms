import { getStudentProfile } from "@/core/students/student-profile";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import { logout } from "../actions";
import { StudentProfileCard } from "../student-profile-card";

// Where a Student lands: their own profile, until the Student dashboard ticket.
export default async function MyProfilePage() {
  let profile;
  try {
    profile = await asCurrentActor((ctx) => getStudentProfile(ctx, { studentId: ctx.actor.userId }));
  } catch (err) {
    return (
      <main className="page">
        <p className="error">{t(refusalKey(err))}</p>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="topbar">
        <h1>{t("studentProfile.myTitle")}</h1>
        <form action={logout}>
          <button className="button-link" type="submit">
            {t("nav.logout")}
          </button>
        </form>
      </header>
      <StudentProfileCard profile={profile} />
    </main>
  );
}

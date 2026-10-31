import { studentAssessmentHistory } from "@/core/assessments/marks";
import { studentTermGrades } from "@/core/grading/term-grades";
import { getStudentProfile } from "@/core/students/student-profile";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import { logout } from "../actions";
import { AssessmentHistory } from "../assessment-history";
import { StudentProfileCard } from "../student-profile-card";
import { TermGrades } from "../term-grades";

// Where a Student lands: their own profile and Assessment history, until the Student dashboard ticket.
export default async function MyProfilePage() {
  let data;
  try {
    data = await asCurrentActor((ctx) =>
      Promise.all([
        getStudentProfile(ctx, { studentId: ctx.actor.userId }),
        studentAssessmentHistory(ctx, { studentId: ctx.actor.userId }),
        studentTermGrades(ctx, { studentId: ctx.actor.userId }),
      ]),
    );
  } catch (err) {
    return (
      <main className="page">
        <p className="error">{t(refusalKey(err))}</p>
      </main>
    );
  }

  const [profile, history, termGrades] = data;

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
      <TermGrades terms={termGrades} />
      <AssessmentHistory rows={history} />
    </main>
  );
}

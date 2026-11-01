// A Student's own profile, Term Grades and whole Assessment history, linked from their dashboard.
import Link from "next/link";
import { studentAssessmentHistory } from "@/core/assessments/marks";
import { studentTermGrades } from "@/core/grading/term-grades";
import { getStudentProfile } from "@/core/students/student-profile";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import { AssessmentHistory } from "../../assessment-history";
import { StudentProfileCard } from "../../student-profile-card";
import { TermGrades } from "../../term-grades";

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
        <Link href="/student">{t("nav.dashboard")}</Link>
      </header>
      <StudentProfileCard profile={profile} />
      <TermGrades terms={termGrades} />
      <AssessmentHistory rows={history} />
    </main>
  );
}

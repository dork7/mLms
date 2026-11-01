import Link from "next/link";
import { studentAssessmentHistory } from "@/core/assessments/marks";
import { enrollmentChoices } from "@/core/enrollment/enrollment";
import { studentTermGrades } from "@/core/grading/term-grades";
import { studentReportCards } from "@/core/report-cards/publish";
import { getStudentProfile } from "@/core/students/student-profile";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import { AssessmentHistory } from "../../../assessment-history";
import { PublishedReportCards } from "../../../published-report-cards";
import { StudentProfileCard } from "../../../student-profile-card";
import { TermGrades } from "../../../term-grades";
import { setStudentLoginEnabled } from "../actions";
import { EnrollmentForm } from "./enrollment-form";
import { ResetPasswordForm } from "./reset-password-form";

export default async function AdminStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let data;
  try {
    data = await asCurrentActor((ctx) => Promise.all([
        getStudentProfile(ctx, { studentId: id }),
        enrollmentChoices(ctx, { studentId: id }),
        studentAssessmentHistory(ctx, { studentId: id }),
        studentTermGrades(ctx, { studentId: id }),
        studentReportCards(ctx, { studentId: id }),
      ]),
    );
  } catch (err) {
    return (
      <main className="page">
        <p className="error">{t(refusalKey(err))}</p>
      </main>
    );
  }
  const [profile, choices, history, termGrades, reportCards] = data;
  const moving = choices.mode === "move";
  const options = choices.classes.map((c) => ({
    id: c.id,
    name: t("enrollment.classOption", { class: c.name, grade: c.grade, year: c.academicYear }),
  }));

  return (
    <main className="page">
      <header className="topbar">
        <h1>{t("studentProfile.title")}</h1>
        <Link href="/admin/students">{t("students.backToList")}</Link>
      </header>
      <StudentProfileCard profile={profile} />
      <TermGrades terms={termGrades} />
      <PublishedReportCards cards={reportCards} />
      <AssessmentHistory rows={history} />
      <section className="card">
        <h2>{moving ? t("enrollment.moveTitle") : t("enrollment.enrollTitle")}</h2>
        {moving && <p className="muted">{t("enrollment.moveHint")}</p>}
        {moving && options.length === 0 ? (
          <p>{t("enrollment.noMoveTargets")}</p>
        ) : (
          <EnrollmentForm
            key={choices.mode}
            studentId={profile.id}
            mode={choices.mode}
            classes={options}
          />
        )}
      </section>
      <section className="card">
        <ResetPasswordForm studentId={profile.id} name={profile.name} />
        <form action={setStudentLoginEnabled}>
          <input type="hidden" name="userId" value={profile.id} />
          <input type="hidden" name="enable" value={String(profile.disabled)} />
          <button className="button-link" type="submit">
            {profile.disabled ? t("students.enable") : t("students.disable")}
          </button>
        </form>
      </section>
    </main>
  );
}

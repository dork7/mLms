import Link from "next/link";
import { studentAssessmentHistory } from "@/core/assessments/marks";
import { listClasses } from "@/core/classes/classes";
import { getStudentProfile } from "@/core/students/student-profile";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import { AssessmentHistory } from "../../../assessment-history";
import { StudentProfileCard } from "../../../student-profile-card";
import { setStudentLoginEnabled } from "../actions";
import { EnrollmentForm } from "./enrollment-form";
import { ResetPasswordForm } from "./reset-password-form";

export default async function AdminStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let data;
  try {
    data = await asCurrentActor((ctx) => Promise.all([
        getStudentProfile(ctx, { studentId: id }),
        listClasses(ctx),
        studentAssessmentHistory(ctx, { studentId: id }),
      ]),
    );
  } catch (err) {
    return (
      <main className="page">
        <p className="error">{t(refusalKey(err))}</p>
      </main>
    );
  }
  const [profile, classes, history] = data;
  const open = profile.enrollments.find((e) => e.endDate === null);
  const current = open && classes.find((c) => c.id === open.classId);
  // Moving stays within the current Class's Grade and Academic Year (the layer checks it too).
  const choices = current
    ? classes.filter(
        (c) => c.id !== current.id && c.gradeId === current.gradeId && c.academicYearId === current.academicYearId,
      )
    : classes;
  const options = choices.map((c) => ({ id: c.id, name: `${c.name} (${c.grade}, ${c.academicYear})` }));

  return (
    <main className="page">
      <header className="topbar">
        <h1>{t("studentProfile.title")}</h1>
        <Link href="/admin/students">{t("students.backToList")}</Link>
      </header>
      <StudentProfileCard profile={profile} />
      <AssessmentHistory rows={history} />
      <section className="card">
        <h2>{current ? t("enrollment.moveTitle") : t("enrollment.enrollTitle")}</h2>
        {current && <p className="muted">{t("enrollment.moveHint")}</p>}
        {current && options.length === 0 ? (
          <p>{t("enrollment.noMoveTargets")}</p>
        ) : (
          <EnrollmentForm
            key={current ? "move" : "enroll"}
            studentId={profile.id}
            mode={current ? "move" : "enroll"}
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

import Link from "next/link";
import { getStudentProfile } from "@/core/students/student-profile";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import { StudentProfileCard } from "../../../student-profile-card";
import { setStudentLoginEnabled } from "../actions";
import { ResetPasswordForm } from "./reset-password-form";

export default async function AdminStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let profile;
  try {
    profile = await asCurrentActor((ctx) => getStudentProfile(ctx, { studentId: id }));
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
        <h1>{t("studentProfile.title")}</h1>
        <Link href="/admin/students">{t("students.backToList")}</Link>
      </header>
      <StudentProfileCard profile={profile} />
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

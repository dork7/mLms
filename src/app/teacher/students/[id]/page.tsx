// A Student's profile for one of their Teachers (the access policy decides who).
import Link from "next/link";
import { getStudentProfile } from "@/core/students/student-profile";
import { t } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import { StudentProfileCard } from "../../../student-profile-card";

export default async function TeacherStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let profile;
  try {
    profile = await asCurrentActor((ctx) => getStudentProfile(ctx, { studentId: id }));
  } catch (err) {
    return (
      <main className="page">
        <p className="error">{t(refusalKey(err))}</p>
        <Link href="/teacher/students">{t("myStudents.backToList")}</Link>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="topbar">
        <h1>{t("studentProfile.title")}</h1>
        <Link href="/teacher/students">{t("myStudents.backToList")}</Link>
      </header>
      <StudentProfileCard profile={profile} />
    </main>
  );
}

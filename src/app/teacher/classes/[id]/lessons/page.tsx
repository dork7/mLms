// The class summary of Lessons for the Class's Class Teacher.
import type { Metadata } from "next";
import { ClassLessonsPage } from "../../../../class-lessons-page";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("pageTitles.classLessons") };

export default async function TeacherClassLessonsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClassLessonsPage classId={Number(id)} classHref={`/teacher/classes/${id}`} />;
}

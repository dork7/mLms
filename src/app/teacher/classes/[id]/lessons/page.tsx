// The class summary of Lessons for the Class's Class Teacher.
import { ClassLessonsPage } from "../../../../class-lessons-page";

export default async function TeacherClassLessonsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClassLessonsPage classId={Number(id)} classHref={`/teacher/classes/${id}`} />;
}

// The class summary of Lessons for the Admin.
import { ClassLessonsPage } from "../../../../class-lessons-page";

export default async function AdminClassLessonsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClassLessonsPage classId={Number(id)} classHref={`/admin/classes/${id}`} />;
}

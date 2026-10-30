// Serves a Student's photo to whoever the access policy lets see that Student.
import { AccessDenied, NotFound } from "@/core/errors";
import { getStudentPhoto } from "@/core/students/student-profile";
import { asCurrentActor } from "@/web/as-current-actor";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let photo;
  try {
    photo = await asCurrentActor((ctx) => getStudentPhoto(ctx, { studentId: id }));
  } catch (err) {
    if (err instanceof AccessDenied) return new Response(null, { status: 403 });
    if (err instanceof NotFound) return new Response(null, { status: 404 });
    throw err;
  }
  if (!photo) return new Response(null, { status: 404 });
  return new Response(Buffer.from(photo.data), {
    headers: {
      "Content-Type": photo.contentType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

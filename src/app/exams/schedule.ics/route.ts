// The acting person's own Exams as a calendar file. The viewer comes from the session, so
// the URL can't name anyone else.
import { AccessDenied } from "@/core/errors";
import { myExamCalendar } from "@/core/exams/exam-schedule";
import { asCurrentActor } from "@/web/as-current-actor";

export async function GET() {
  let calendar;
  try {
    calendar = await asCurrentActor((ctx) => myExamCalendar(ctx));
  } catch (err) {
    if (err instanceof AccessDenied) return new Response(null, { status: 403 });
    throw err;
  }
  return new Response(calendar, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="exam-schedule.ics"',
      "Cache-Control": "private, no-store",
    },
  });
}

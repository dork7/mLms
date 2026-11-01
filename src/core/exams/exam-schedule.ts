// A person's own Exam schedule: a Student's is the Exams of the Class they are enrolled
// in today, and a Teacher's is the Exams of the Class Subjects they teach. A Student also
// has the past Exams of their earlier Enrollments, shown apart. The viewer is always the
// actor, so nobody can ask for someone else's. `access.ts` says which Exams are whose.
import { and, eq, inArray, or } from "drizzle-orm";
import { classSubject, enrollment, user } from "@/db/schema";
import { t } from "@/i18n";
import { isOwnExam, isOwnPastExam, requireRole } from "../access";
import type { AssessmentType } from "../assessments/assessments";
import type { Ctx } from "../context";
import { clockTime, examRows, startMinute } from "./exams";
import { icsCalendar } from "./ics";

export type ScheduledExam = {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  subject: string;
  type: AssessmentType;
  class: string;
  room: string;
};

export type ExamSchedule = {
  name: string;
  /** Their current Exams, in time order: the schedule itself, and what the .ics file holds. */
  exams: ScheduledExam[];
  /** A Student's Exams from their earlier Enrollments, newest first. Read-only history. */
  pastExams: ScheduledExam[];
};

/** The acting Student's or Teacher's own Exams. */
export async function myExamSchedule(ctx: Ctx): Promise<ExamSchedule> {
  requireRole(ctx.actor, "student", "teacher");
  const [me] = await ctx.db.select({ name: user.name }).from(user).where(eq(user.id, ctx.actor.userId));
  const [rows, pastRows] = await Promise.all([
    examRows(ctx.db, isOwnExam(ctx)),
    examRows(ctx.db, isOwnPastExam(ctx)),
  ]);
  return { name: me.name, exams: rows.map(scheduled), pastExams: pastRows.reverse().map(scheduled) };
}

function scheduled(r: Awaited<ReturnType<typeof examRows>>[number]): ScheduledExam {
  const start = startMinute(r.startTime);
  return {
    id: r.id,
    date: r.date,
    startTime: clockTime(start),
    endTime: clockTime(start + r.durationMinutes),
    durationMinutes: r.durationMinutes,
    subject: r.subject,
    type: r.type,
    class: r.class,
    room: r.room,
  };
}

/**
 * The same Exams as an .ics file. Times are written in UTC, so an Exam stays at the right
 * moment in a calendar set to another time zone than the school's.
 */
export async function myExamCalendar(ctx: Ctx): Promise<string> {
  const { exams } = await myExamSchedule(ctx);
  return icsCalendar(
    ctx.clock.now(),
    exams.map((e) => {
      const start = ctx.clock.at(e.date, startMinute(e.startTime));
      return {
        uid: `exam-${e.id}@school-lms`,
        start,
        end: new Date(start.getTime() + e.durationMinutes * 60_000),
        summary: t("examSchedule.eventSummary", {
          subject: e.subject,
          type: t(`assessments.types.${e.type}`),
          class: e.class,
        }),
        location: e.room,
      };
    }),
  );
}

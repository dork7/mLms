// A person's own Exam schedule: a Student's is the Exams of the Class they are enrolled
// in today, and a Teacher's is the Exams of the Class Subjects they teach. The viewer is
// always the actor, so nobody can ask for someone else's.
import { and, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { classSubject, enrollment, user } from "@/db/schema";
import { t } from "@/i18n";
import { requireRole } from "../access";
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

export type ExamSchedule = { name: string; exams: ScheduledExam[] };

/** The acting Student's or Teacher's own Exams, in time order. */
export async function myExamSchedule(ctx: Ctx): Promise<ExamSchedule> {
  requireRole(ctx.actor, "student", "teacher");
  const [me] = await ctx.db.select({ name: user.name }).from(user).where(eq(user.id, ctx.actor.userId));
  const rows = await examRows(ctx.db, ownExams(ctx));
  return {
    name: me.name,
    exams: rows.map((r) => {
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
    }),
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

function ownExams(ctx: Ctx) {
  const me = ctx.actor.userId;
  if (ctx.actor.role === "teacher") return eq(classSubject.teacherId, me);
  const today = ctx.clock.today();
  return inArray(
    classSubject.classId,
    ctx.db
      .select({ classId: enrollment.classId })
      .from(enrollment)
      .where(
        and(
          eq(enrollment.studentId, me),
          lte(enrollment.startDate, today),
          or(isNull(enrollment.endDate), gte(enrollment.endDate, today)),
        ),
      ),
  );
}

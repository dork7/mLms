// What a Student lands on: their next Exam and their latest Marks.
import { requireRole } from "../access";
import { type HistoryRow, studentAssessmentHistory } from "../assessments/marks";
import type { Ctx } from "../context";
import { myExamSchedule, type ScheduledExam } from "../exams/exam-schedule";
import { startMinute } from "../exams/exams";

const LATEST_MARKS = 5;

export type StudentDashboard = {
  name: string;
  /** The soonest Exam of their Class that hasn't started yet; null if none. */
  nextExam: ScheduledExam | null;
  /** Their latest entered Marks by Assessment date, newest first. Absent and Exempt are Marks. */
  latestMarks: HistoryRow[];
};

export async function getStudentDashboard(ctx: Ctx): Promise<StudentDashboard> {
  requireRole(ctx.actor, "student");
  const [schedule, history] = await Promise.all([
    myExamSchedule(ctx),
    studentAssessmentHistory(ctx, { studentId: ctx.actor.userId }),
  ]);
  const now = ctx.clock.now();
  return {
    name: schedule.name,
    nextExam: schedule.exams.find((e) => ctx.clock.at(e.date, startMinute(e.startTime)) >= now) ?? null,
    latestMarks: history.filter((row) => row.mark !== null).slice(0, LATEST_MARKS),
  };
}

// What a Teacher lands on: the Class Subjects they teach, what was last taught in them, and
// which of their Assessments they still have Marks to enter for. All of it follows the
// current Subject Teacher, so a reassignment hands it over.
import { and, desc, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { academicYear, assessment, classSubject, enrollment, lesson, mark, schoolClass, subject, user } from "@/db/schema";
import { requireRole } from "../access";
import { type AssessmentRow, selectAssessments } from "../assessments/assessments";
import { type ClassSubjectRow, listMyClassSubjects } from "../classes/class-subjects";
import type { Ctx } from "../context";
import type { LessonRow } from "../lessons/lessons";
import { frozenMarksOn } from "../report-cards/publications";

const RECENT_LESSONS = 5;

export type RecentLesson = LessonRow & { class: string };

export type AssessmentNeedingMarks = AssessmentRow & {
  /** How many Students on the roster have no Mark yet and can still be given one. */
  missingMarks: number;
};

export type TeacherDashboard = {
  classSubjects: ClassSubjectRow[];
  /** The latest Lessons of those Class Subjects, whoever logged them. */
  recentLessons: RecentLesson[];
  assessmentsNeedingMarks: AssessmentNeedingMarks[];
};

export async function getTeacherDashboard(ctx: Ctx): Promise<TeacherDashboard> {
  requireRole(ctx.actor, "teacher");
  const [classSubjects, recentLessons, assessmentsNeedingMarks] = await Promise.all([
    listMyClassSubjects(ctx),
    latestLessons(ctx),
    needingMarks(ctx),
  ]);
  return { classSubjects, recentLessons, assessmentsNeedingMarks };
}

function latestLessons(ctx: Ctx): Promise<RecentLesson[]> {
  return ctx.db
    .select({
      id: lesson.id,
      classSubjectId: lesson.classSubjectId,
      date: lesson.date,
      period: lesson.period,
      subject: subject.name,
      class: schoolClass.name,
      teacher: user.name,
      topic: lesson.topic,
      homework: lesson.homework,
    })
    .from(lesson)
    .innerJoin(classSubject, eq(classSubject.id, lesson.classSubjectId))
    .innerJoin(schoolClass, eq(schoolClass.id, classSubject.classId))
    .innerJoin(subject, eq(subject.id, classSubject.subjectId))
    .innerJoin(user, eq(user.id, lesson.teacherId))
    .where(eq(classSubject.teacherId, ctx.actor.userId))
    .orderBy(desc(lesson.date), desc(lesson.period), desc(lesson.id))
    .limit(RECENT_LESSONS);
}

/**
 * The acting Subject Teacher's Assessments, newest first, where a Mark can be entered now and
 * isn't: the date has come, the year isn't Closed, and a Student on the roster that day has
 * no Mark that a Publication doesn't freeze. Absent and Exempt are Marks.
 */
async function needingMarks(ctx: Ctx): Promise<AssessmentNeedingMarks[]> {
  const unmarked = await ctx.db
    .select({ assessmentId: assessment.id, studentId: enrollment.studentId })
    .from(assessment)
    .innerJoin(classSubject, eq(classSubject.id, assessment.classSubjectId))
    .innerJoin(schoolClass, eq(schoolClass.id, classSubject.classId))
    .innerJoin(academicYear, eq(academicYear.id, schoolClass.academicYearId))
    .innerJoin(
      enrollment,
      and(
        eq(enrollment.classId, schoolClass.id),
        lte(enrollment.startDate, assessment.date),
        or(isNull(enrollment.endDate), gte(enrollment.endDate, assessment.date)),
      ),
    )
    .leftJoin(mark, and(eq(mark.assessmentId, assessment.id), eq(mark.studentId, enrollment.studentId)))
    .where(
      and(
        eq(classSubject.teacherId, ctx.actor.userId),
        isNull(academicYear.closedAt),
        lte(assessment.date, ctx.clock.today()),
        isNull(mark.assessmentId),
      ),
    );
  if (unmarked.length === 0) return [];

  const rows = await selectAssessments(
    ctx,
    inArray(assessment.id, [...new Set(unmarked.map((u) => u.assessmentId))]),
  );
  const counted = await Promise.all(
    rows.map(async (row) => {
      const frozen = await frozenMarksOn(ctx.db, row);
      const missing = unmarked.filter(
        (u) => u.assessmentId === row.id && !frozen.wholeClass && !frozen.students.has(u.studentId),
      );
      return { ...row, missingMarks: missing.length };
    }),
  );
  return counted.filter((row) => row.missingMarks > 0);
}

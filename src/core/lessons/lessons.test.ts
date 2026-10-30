// Lessons: a Subject Teacher logs what they taught; the Admin and the Class
// Teacher read the class summary.
//
//   7-A: Class Teacher Huda. Math taught by Omar, Science taught by Sara.
//   7-B: Class Teacher Sara. Math taught by Omar.
//   6 Periods per day. Today is 2026-10-15.
import { describe, expect, it } from "vitest";
import type { Actor } from "../context";
import { AccessDenied, InvalidInput, LessonExists, NotFound } from "../errors";
import { createClass } from "../classes/classes";
import { createClassSubject, reassignSubjectTeacher } from "../classes/class-subjects";
import { school } from "../classes/test-school";
import { setPeriodsPerDay } from "../school/periods";
import { lessonFormDefaults, listClassLessons, listClassSubjectLessons, logLesson } from "./lessons";

async function lessonsSchool() {
  const s = await school();
  const { app, asAdmin, year, grade7, math, science, huda, omar, sara } = s;
  app.clock.set("2026-10-15T10:00:00+04:00");
  await setPeriodsPerDay(asAdmin, 6);
  const newClass = (name: string, teacher: Actor) =>
    createClass(asAdmin, { academicYearId: year.id, gradeId: grade7.id, name, classTeacherId: teacher.userId });
  const teach = (classId: number, subjectId: number, teacher: Actor) =>
    createClassSubject(asAdmin, { classId, subjectId, teacherId: teacher.userId });
  const class7A = await newClass("7-A", huda);
  const class7B = await newClass("7-B", sara);
  const math7A = await teach(class7A.id, math.id, omar);
  const science7A = await teach(class7A.id, science.id, sara);
  const math7B = await teach(class7B.id, math.id, omar);
  return { ...s, class7A, class7B, math7A, science7A, math7B };
}

describe("Logging a Lesson", () => {
  it("a Subject Teacher logs a Lesson and it appears in the class summary", async () => {
    const { app, admin, omar, class7A, math7A } = await lessonsSchool();

    await logLesson(app.as(omar), {
      classSubjectId: math7A.id,
      date: "2026-10-15",
      period: 2,
      topic: "Fractions: adding unlike denominators",
      homework: "Page 42, questions 1-10",
    });

    expect(await listClassLessons(app.as(admin), { classId: class7A.id })).toMatchObject([
      {
        date: "2026-10-15",
        period: 2,
        subject: "Math",
        teacher: "Omar",
        topic: "Fractions: adding unlike denominators",
        homework: "Page 42, questions 1-10",
      },
    ]);
  });

  it("anyone other than the Class Subject's Subject Teacher is refused", async () => {
    const { app, admin, huda, sara, class7A, math7A } = await lessonsSchool();
    const lesson = { classSubjectId: math7A.id, date: "2026-10-15", period: 1, topic: "Ratios" };

    // Sara teaches Science in 7-A; Huda is 7-A's Class Teacher; neither teaches Math in 7-A.
    await expect(logLesson(app.as(sara), lesson)).rejects.toThrow(AccessDenied);
    await expect(logLesson(app.as(huda), lesson)).rejects.toThrow(AccessDenied);
    await expect(logLesson(app.as(admin), lesson)).rejects.toThrow(AccessDenied);
    await expect(logLesson(app.as({ role: "student", userId: "s1" }), lesson)).rejects.toThrow(AccessDenied);
    await expect(logLesson(app.as(sara), { ...lesson, classSubjectId: 99999 })).rejects.toThrow(NotFound);

    expect(await listClassLessons(app.as(admin), { classId: class7A.id })).toEqual([]);
  });

  it("the Period must be one of the school day's Periods, 1 to N", async () => {
    const { app, omar, math7A } = await lessonsSchool();
    const lesson = { classSubjectId: math7A.id, date: "2026-10-15", topic: "Ratios" };

    await expect(logLesson(app.as(omar), { ...lesson, period: 0 })).rejects.toThrow(InvalidInput);
    await expect(logLesson(app.as(omar), { ...lesson, period: 7 })).rejects.toThrow(InvalidInput);
    await expect(logLesson(app.as(omar), { ...lesson, period: 2.5 })).rejects.toThrow(InvalidInput);
    await expect(logLesson(app.as(omar), { ...lesson, period: 6 })).resolves.toMatchObject({});
  });

  it("only one Lesson can be logged per Class Subject, date and Period", async () => {
    const { app, omar, math7A, math7B } = await lessonsSchool();
    const lesson = { classSubjectId: math7A.id, date: "2026-10-15", period: 3, topic: "Ratios" };

    await logLesson(app.as(omar), lesson);
    await expect(logLesson(app.as(omar), { ...lesson, topic: "Again" })).rejects.toThrow(LessonExists);
    // The same Period on another day, or in another Class, is a different Lesson.
    await logLesson(app.as(omar), { ...lesson, date: "2026-10-14" });
    await logLesson(app.as(omar), { ...lesson, classSubjectId: math7B.id });
  });

  it("a Lesson needs a topic; homework is optional", async () => {
    const { app, admin, omar, class7A, math7A } = await lessonsSchool();
    const lesson = { classSubjectId: math7A.id, date: "2026-10-15", period: 1 };

    await expect(logLesson(app.as(omar), { ...lesson, topic: "   " })).rejects.toThrow(InvalidInput);
    await logLesson(app.as(omar), { ...lesson, topic: "  Ratios  " });

    expect(await listClassLessons(app.as(admin), { classId: class7A.id })).toMatchObject([
      { topic: "Ratios", homework: "" },
    ]);
  });

  it("a Lesson can't be logged for a day in the future or outside the Class's Academic Year", async () => {
    const { app, omar, math7A } = await lessonsSchool();
    const lesson = { classSubjectId: math7A.id, period: 1, topic: "Ratios" };

    await expect(logLesson(app.as(omar), { ...lesson, date: "2026-10-16" })).rejects.toThrow(InvalidInput);
    await expect(logLesson(app.as(omar), { ...lesson, date: "2026-08-31" })).rejects.toThrow(InvalidInput);
    await expect(logLesson(app.as(omar), { ...lesson, date: "2026-02-30" })).rejects.toThrow(InvalidInput);
    await expect(logLesson(app.as(omar), { ...lesson, date: "not a date" })).rejects.toThrow(InvalidInput);
    await logLesson(app.as(omar), { ...lesson, date: "2026-09-01" });
  });

  it("the Subject Teacher's Lesson form starts on today and offers Periods 1 to N; no one else gets it", async () => {
    const { app, admin, huda, omar, math7A } = await lessonsSchool();

    expect(await lessonFormDefaults(app.as(omar), { classSubjectId: math7A.id })).toEqual({
      today: "2026-10-15",
      periodsPerDay: 6,
    });
    await expect(lessonFormDefaults(app.as(huda), { classSubjectId: math7A.id })).rejects.toThrow(AccessDenied);
    await expect(lessonFormDefaults(app.as(admin), { classSubjectId: math7A.id })).rejects.toThrow(AccessDenied);
  });
});

describe("The class summary", () => {
  async function loggedWeek() {
    const s = await lessonsSchool();
    const { app, omar, sara, math7A, science7A, math7B } = s;
    const log = (who: Actor, classSubjectId: number, date: string, period: number, topic: string) =>
      logLesson(app.as(who), { classSubjectId, date, period, topic });
    await log(sara, science7A.id, "2026-10-14", 3, "Cells");
    await log(omar, math7A.id, "2026-10-15", 1, "Ratios");
    await log(omar, math7A.id, "2026-10-14", 1, "Fractions");
    await log(sara, science7A.id, "2026-10-14", 1, "Microscopes");
    await log(omar, math7B.id, "2026-10-15", 2, "Ratios (7-B)");
    return s;
  }
  const lines = (rows: { date: string; period: number; subject: string; teacher: string; topic: string }[]) =>
    rows.map((r) => `${r.date} P${r.period} ${r.subject} ${r.teacher}: ${r.topic}`);

  it("lists a Class's Lessons by day, newest first, then Period and Subject, with the Teacher", async () => {
    const { app, admin, class7A } = await loggedWeek();

    expect(lines(await listClassLessons(app.as(admin), { classId: class7A.id }))).toEqual([
      "2026-10-15 P1 Math Omar: Ratios",
      "2026-10-14 P1 Math Omar: Fractions",
      "2026-10-14 P1 Science Sara: Microscopes",
      "2026-10-14 P3 Science Sara: Cells",
    ]);
  });

  it("the Class Teacher sees their Class's summary; other Teachers are refused", async () => {
    const { app, huda, omar, sara, class7A, class7B } = await loggedWeek();

    expect(await listClassLessons(app.as(huda), { classId: class7A.id })).toHaveLength(4);
    // Omar teaches Math in 7-A but is not its Class Teacher.
    await expect(listClassLessons(app.as(omar), { classId: class7A.id })).rejects.toThrow(AccessDenied);
    // Sara is 7-B's Class Teacher: she sees 7-B, not 7-A, though she teaches Science there.
    expect(lines(await listClassLessons(app.as(sara), { classId: class7B.id }))).toEqual([
      "2026-10-15 P2 Math Omar: Ratios (7-B)",
    ]);
    await expect(listClassLessons(app.as(sara), { classId: class7A.id })).rejects.toThrow(AccessDenied);
    await expect(listClassLessons(app.as({ role: "student", userId: "s1" }), { classId: class7A.id })).rejects.toThrow(
      AccessDenied,
    );
  });

  it("after a Class Subject is reassigned, earlier Lessons still name the Teacher who taught them", async () => {
    const { app, asAdmin, admin, omar, sara, class7B, math7B } = await loggedWeek();

    await reassignSubjectTeacher(asAdmin, { classSubjectId: math7B.id, teacherId: sara.userId });
    await expect(
      logLesson(app.as(omar), { classSubjectId: math7B.id, date: "2026-10-15", period: 3, topic: "Late" }),
    ).rejects.toThrow(AccessDenied);
    await logLesson(app.as(sara), { classSubjectId: math7B.id, date: "2026-10-15", period: 4, topic: "Percentages" });

    expect(lines(await listClassLessons(app.as(admin), { classId: class7B.id }))).toEqual([
      "2026-10-15 P2 Math Omar: Ratios (7-B)",
      "2026-10-15 P4 Math Sara: Percentages",
    ]);
  });

  it("a Subject Teacher sees the Lessons of their own Class Subject", async () => {
    const { app, omar, sara, math7A } = await loggedWeek();

    expect(lines(await listClassSubjectLessons(app.as(omar), { classSubjectId: math7A.id }))).toEqual([
      "2026-10-15 P1 Math Omar: Ratios",
      "2026-10-14 P1 Math Omar: Fractions",
    ]);
    await expect(listClassSubjectLessons(app.as(sara), { classSubjectId: math7A.id })).rejects.toThrow(AccessDenied);
  });
});

import { describe, expect, it } from "vitest";
import { saveMarks } from "../assessments/marks";
import { createAssessment } from "../assessments/assessments";
import { quiz, assessmentSchool } from "../assessments/test-assessments";
import { reassignSubjectTeacher } from "../classes/class-subjects";
import { moveStudent } from "../enrollment/enrollment";
import { AccessDenied } from "../errors";
import { logLesson } from "../lessons/lessons";
import { publishReportCards } from "../report-cards/publish";
import { setPeriodsPerDay } from "../school/periods";
import { createAcademicYear } from "../school/academic-year";
import { closeAcademicYear, promoteClass } from "../year-end/year-end";
import { yearTerms } from "../grading/term-grades";
import { getTeacherDashboard } from "./teacher-dashboard";

/** Today 2026-10-20. Aisha and Bilal are in 7-A. Sara teaches Math in 7-A and 7-B, Huda Science in 7-B. */
async function teacherSchool() {
  const s = await assessmentSchool();
  await setPeriodsPerDay(s.asAdmin, 6);
  const lesson = (classSubjectId: number, date: string, period: number, topic: string) => ({
    classSubjectId,
    date,
    period,
    topic,
  });
  return { ...s, lesson };
}

describe("Teacher dashboard", () => {
  it("is refused to the Admin and to a Student", async () => {
    const s = await teacherSchool();

    await expect(getTeacherDashboard(s.asAdmin)).rejects.toThrow(AccessDenied);
    await expect(getTeacherDashboard(s.app.as({ role: "student", userId: s.aisha }))).rejects.toThrow(AccessDenied);
  });

  it("lists only the Class Subjects the Teacher teaches", async () => {
    const s = await teacherSchool();

    const dashboard = await getTeacherDashboard(s.asSara);

    expect(dashboard.classSubjects.map((cs) => [cs.subject, cs.class])).toEqual([
      ["Math", "7-A"],
      ["Math", "7-B"],
    ]);
  });
});

describe("recent Lessons on the Teacher dashboard", () => {
  it("shows the latest first, naming the Class, and only for the Teacher's own Class Subjects", async () => {
    const s = await teacherSchool();
    await logLesson(s.asSara, s.lesson(s.math7A.id, "2026-10-12", 1, "Fractions"));
    await logLesson(s.asSara, s.lesson(s.math7B.id, "2026-10-14", 2, "Decimals, second"));
    await logLesson(s.asSara, s.lesson(s.math7B.id, "2026-10-14", 1, "Decimals, first"));
    await logLesson(s.asHuda, s.lesson(s.science7B.id, "2026-10-15", 1, "Cells"));

    const { recentLessons } = await getTeacherDashboard(s.asSara);

    expect(recentLessons.map((l) => [l.date, l.period, l.subject, l.class, l.topic])).toEqual([
      ["2026-10-14", 2, "Math", "7-B", "Decimals, second"],
      ["2026-10-14", 1, "Math", "7-B", "Decimals, first"],
      ["2026-10-12", 1, "Math", "7-A", "Fractions"],
    ]);
  });

  it("shows no more than the five latest", async () => {
    const s = await teacherSchool();
    for (const day of [11, 12, 13, 14, 15, 16]) {
      await logLesson(s.asSara, s.lesson(s.math7A.id, `2026-10-${day}`, 1, `Day ${day}`));
    }

    const { recentLessons } = await getTeacherDashboard(s.asSara);

    expect(recentLessons.map((l) => l.topic)).toEqual(["Day 16", "Day 15", "Day 14", "Day 13", "Day 12"]);
  });

  it("follows the Class Subject when it is reassigned, naming who taught", async () => {
    const s = await teacherSchool();
    await logLesson(s.asSara, s.lesson(s.math7A.id, "2026-10-12", 1, "Fractions"));

    await reassignSubjectTeacher(s.asAdmin, { classSubjectId: s.math7A.id, teacherId: s.omar.userId });

    expect((await getTeacherDashboard(s.asSara)).recentLessons).toEqual([]);
    expect((await getTeacherDashboard(s.asOmar)).recentLessons.map((l) => [l.topic, l.teacher])).toEqual([
      ["Fractions", "Sara"],
    ]);
  });
});

describe("Assessments that still need Marks on the Teacher dashboard", () => {
  const needing = async (s: Awaited<ReturnType<typeof teacherSchool>>, asTeacher = s.asSara) =>
    (await getTeacherDashboard(asTeacher)).assessmentsNeedingMarks;

  it("lists an Assessment with Students left to mark, saying how many", async () => {
    const s = await teacherSchool();
    const assessment = await createAssessment(s.asSara, quiz(s.math7A.id));
    await saveMarks(s.asSara, { assessmentId: assessment.id, marks: [{ studentId: s.aisha, mark: 8 }] });

    expect(await needing(s)).toMatchObject([
      { id: assessment.id, subject: "Math", class: "7-A", date: "2026-09-20", missingMarks: 1 },
    ]);
  });

  it("treats Absent and Exempt as Marks, so a fully marked grid needs nothing", async () => {
    const s = await teacherSchool();
    const assessment = await createAssessment(s.asSara, quiz(s.math7A.id));

    await saveMarks(s.asSara, {
      assessmentId: assessment.id,
      marks: [
        { studentId: s.aisha, mark: "absent" },
        { studentId: s.bilal, mark: "exempt" },
      ],
    });

    expect(await needing(s)).toEqual([]);
  });

  it("waits until the Assessment's date", async () => {
    const s = await teacherSchool();
    await createAssessment(s.asSara, quiz(s.math7A.id, { date: "2026-10-21" }));
    expect(await needing(s)).toEqual([]);

    s.app.clock.set("2026-10-21T08:00:00+04:00");

    expect((await needing(s)).map((a) => a.date)).toEqual(["2026-10-21"]);
  });

  it("asks only about Students on the roster on the Assessment's date", async () => {
    const s = await teacherSchool();
    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-10-01" });
    await moveStudent(s.asAdmin, { studentId: s.bilal, classId: s.class7B.id, date: "2026-10-01" });

    const before = await createAssessment(s.asSara, quiz(s.math7A.id, { date: "2026-09-20" }));
    await createAssessment(s.asSara, quiz(s.math7A.id, { date: "2026-10-10" }));

    // Both left 7-A before the second quiz, so its grid is empty. They still owe the first one.
    expect((await needing(s)).map((a) => [a.id, a.missingMarks])).toEqual([[before.id, 2]]);
  });

  it("leaves out an Assessment with nobody on its roster", async () => {
    const s = await teacherSchool();
    await createAssessment(s.asSara, quiz(s.math7B.id));

    expect(await needing(s)).toEqual([]);
  });

  it("belongs to the current Subject Teacher, not the Class Teacher", async () => {
    const s = await teacherSchool();
    await createAssessment(s.asSara, quiz(s.math7A.id));

    expect(await needing(s, s.asHuda)).toEqual([]);

    await reassignSubjectTeacher(s.asAdmin, { classSubjectId: s.math7A.id, teacherId: s.omar.userId });

    expect(await needing(s)).toEqual([]);
    expect(await needing(s, s.asOmar)).toHaveLength(1);
  });

  it("leaves out Marks that a Published Report Card freezes, since they can't be entered", async () => {
    const s = await teacherSchool();
    await createAssessment(s.asSara, quiz(s.math7A.id));
    const [term1] = await yearTerms(s.app.deps.db, s.year.id);
    expect(await needing(s)).toHaveLength(1);

    await publishReportCards(s.asAdmin, { classId: s.class7A.id, termId: term1.id });

    expect(await needing(s)).toEqual([]);
  });

  it("counts only the Marks still open when another Class's Publication freezes one Student", async () => {
    const s = await teacherSchool();
    const assessment = await createAssessment(s.asSara, quiz(s.math7A.id));
    const [term1] = await yearTerms(s.app.deps.db, s.year.id);
    // Aisha's Report Card is 7-B's, so Publishing 7-B freezes her Mark on 7-A's quiz, not Bilal's.
    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-10-01" });
    await publishReportCards(s.asAdmin, { classId: s.class7B.id, termId: term1.id });

    expect((await needing(s)).map((a) => [a.id, a.missingMarks])).toEqual([[assessment.id, 1]]);
  });

  it("leaves out a Closed year", async () => {
    const s = await teacherSchool();
    await createAssessment(s.asSara, quiz(s.math7A.id));
    await createAcademicYear(s.asAdmin, {
      name: "2027-2028",
      startDate: "2027-09-01",
      endDate: "2028-06-30",
      terms: [{ name: "Term 1", startDate: "2027-09-01", endDate: "2028-06-30" }],
    });
    await promoteClass(s.asAdmin, {
      classId: s.class7A.id,
      leaving: [{ studentId: s.aisha }, { studentId: s.bilal }],
    });
    expect(await needing(s)).toHaveLength(1);

    await closeAcademicYear(s.asAdmin, { academicYearId: s.year.id });

    expect(await needing(s)).toEqual([]);
  });
});

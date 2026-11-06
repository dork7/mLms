import { describe, expect, it } from "vitest";
import { testApp } from "../../../test/test-app";
import { listAssessments } from "../assessments/assessments";
import { marksGrid, saveMarks } from "../assessments/marks";
import { assessmentSchool } from "../assessments/test-assessments";
import { createClassSubject } from "../classes/class-subjects";
import { createClass } from "../classes/classes";
import { AccessDenied, ExamClashForClass, ExamClashForRoom, NotFound } from "../errors";
import { listAcademicYears } from "../school/academic-year";
import { createGrade, createRoom } from "../school/catalogue";
import { addExam, examTimetable } from "./exams";

/** Today is 2026-10-20. Term 1 runs to 2026-12-31. Two Rooms, on top of `assessmentSchool()`. */
async function examSchool() {
  const s = await assessmentSchool();
  const hall = await createRoom(s.asAdmin, { name: "Hall" });
  const lab = await createRoom(s.asAdmin, { name: "Lab" });
  return { ...s, hall, lab };
}

/** A 90-minute final at 09:00 on 2026-11-10, out of 100 with weight 3, unless overridden. */
const final = (classSubjectId: number, roomId: number, over: Partial<Parameters<typeof addExam>[1]> = {}) => ({
  classSubjectId,
  roomId,
  type: "final" as const,
  date: "2026-11-10",
  startTime: "09:00",
  durationMinutes: 90,
  maxMarks: 100,
  weight: 3,
  ...over,
});

describe("adding an Exam", () => {
  it("creates its Assessment, and the Subject Teacher enters Exam Marks in the normal grid", async () => {
    const s = await examSchool();

    const exam = await addExam(s.asAdmin, final(s.math7A.id, s.hall.id));

    const assessments = await listAssessments(s.asSara, { classSubjectId: s.math7A.id });
    expect(assessments).toMatchObject([
      { id: exam.assessmentId, type: "final", date: "2026-11-10", term: "Term 1", maxMarks: 100, weight: 3 },
    ]);

    await saveMarks(s.asSara, { assessmentId: exam.assessmentId, marks: [{ studentId: s.aisha, mark: 87 }] });
    const grid = await marksGrid(s.asSara, { assessmentId: exam.assessmentId });
    expect(grid.canEnterMarks).toBe(true);
    expect(grid.rows.find((r) => r.studentId === s.aisha)?.mark).toBe(87);
  });
});

describe("the Term's exam timetable", () => {
  const termIds = async (s: Awaited<ReturnType<typeof examSchool>>) => {
    const [year] = await listAcademicYears(s.asAdmin);
    return { term1: year.terms[0].id, term2: year.terms[1].id };
  };

  it("groups a grade-wide Exam: the same Subject and time across several Classes", async () => {
    const s = await examSchool();
    const { term1 } = await termIds(s);
    const b = await addExam(s.asAdmin, final(s.math7B.id, s.lab.id));
    const a = await addExam(s.asAdmin, final(s.math7A.id, s.hall.id));

    const timetable = await examTimetable(s.asAdmin, { termId: term1 });

    expect(timetable?.term).toMatchObject({ name: "Term 1", academicYear: "2026-2027" });
    expect(timetable?.groups).toEqual([
      {
        date: "2026-11-10",
        startTime: "09:00",
        endTime: "10:30",
        durationMinutes: 90,
        grade: "Grade 7",
        subject: "Math",
        type: "final",
        exams: [
          { id: a.id, assessmentId: a.assessmentId, class: "7-A", room: "Hall", teacher: "Sara" },
          { id: b.id, assessmentId: b.assessmentId, class: "7-B", room: "Lab", teacher: "Sara" },
        ],
      },
    ]);
  });

  it("keeps Exams apart when the Subject, start, duration or Grade differs, in time order", async () => {
    const s = await examSchool();
    const { term1 } = await termIds(s);
    const grade8 = await createGrade(s.asAdmin, { name: "Grade 8" });
    const class8A = await createClass(s.asAdmin, {
      academicYearId: s.year.id,
      gradeId: grade8.id,
      name: "8-A",
      classTeacherId: s.omar.userId,
    });
    const math8A = await createClassSubject(s.asAdmin, {
      classId: class8A.id,
      subjectId: s.math.id,
      teacherId: s.omar.userId,
    });
    const gym = await createRoom(s.asAdmin, { name: "Gym" });

    await addExam(s.asAdmin, final(s.math7A.id, s.hall.id, { date: "2026-11-11" })); // a later day
    await addExam(s.asAdmin, final(s.science7B.id, s.lab.id, { startTime: "11:00" })); // another Subject and time
    await addExam(s.asAdmin, final(s.math7B.id, s.lab.id, { durationMinutes: 60 })); // same start, another duration
    await addExam(s.asAdmin, final(s.math7A.id, s.hall.id)); // 09:00, 90 minutes
    await addExam(s.asAdmin, final(math8A.id, s.hall.id, { date: "2026-11-12" })); // another Grade...
    await addExam(s.asAdmin, final(s.math7A.id, gym.id, { date: "2026-11-12" })); // ...at the same time as this

    const timetable = await examTimetable(s.asAdmin, { termId: term1 });

    expect(
      timetable?.groups.map((g) => [g.date, g.startTime, g.endTime, g.grade, g.subject, g.exams.map((e) => e.class)]),
    ).toEqual([
      ["2026-11-10", "09:00", "10:00", "Grade 7", "Math", ["7-B"]],
      ["2026-11-10", "09:00", "10:30", "Grade 7", "Math", ["7-A"]],
      ["2026-11-10", "11:00", "12:30", "Grade 7", "Science", ["7-B"]],
      ["2026-11-11", "09:00", "10:30", "Grade 7", "Math", ["7-A"]],
      ["2026-11-12", "09:00", "10:30", "Grade 7", "Math", ["7-A"]],
      ["2026-11-12", "09:00", "10:30", "Grade 8", "Math", ["8-A"]],
    ]);
  });

  it("shows only that Term's Exams, worked out from their dates", async () => {
    const s = await examSchool();
    const { term1, term2 } = await termIds(s);
    await addExam(s.asAdmin, final(s.math7A.id, s.hall.id, { date: "2026-12-31" }));
    await addExam(s.asAdmin, final(s.math7A.id, s.hall.id, { date: "2027-01-01" }));

    const dates = async (termId: number) =>
      (await examTimetable(s.asAdmin, { termId }))?.groups.map((g) => g.date);

    expect(await dates(term1)).toEqual(["2026-12-31"]);
    expect(await dates(term2)).toEqual(["2027-01-01"]);
  });

  it("shows the Term that today falls in when none is asked for", async () => {
    const s = await examSchool();

    expect((await examTimetable(s.asAdmin, {}))?.term.name).toBe("Term 1");

    s.app.clock.set("2027-02-01T08:00:00+04:00");
    expect((await examTimetable(s.asAdmin, {}))?.term.name).toBe("Term 2");
  });

  it("falls back to the newest Academic Year's first Term when today is in no Term", async () => {
    const s = await examSchool();
    s.app.clock.set("2030-01-01T08:00:00+04:00");

    expect((await examTimetable(s.asAdmin, {}))?.term.name).toBe("Term 1");
  });

  it("has nothing to show before any Academic Year exists", async () => {
    const app = await testApp();
    const asAdmin = app.as(await app.seedAdmin());

    expect(await examTimetable(asAdmin, {})).toBeNull();
  });

  it("refuses a Term that doesn't exist", async () => {
    const s = await examSchool();

    await expect(examTimetable(s.asAdmin, { termId: 9999 })).rejects.toThrow(NotFound);
    await expect(examTimetable(s.asAdmin, { termId: Number.NaN })).rejects.toThrow(NotFound);
  });

  it("is for the Admin only", async () => {
    const s = await examSchool();
    const { term1 } = await termIds(s);

    await expect(examTimetable(s.asSara, { termId: term1 })).rejects.toThrow(AccessDenied);
    await expect(examTimetable(s.app.as({ role: "student", userId: s.aisha }), { termId: term1 })).rejects.toThrow(
      AccessDenied,
    );
  });
});

describe("clash rules", () => {
  it("refuses an Exam that overlaps another Exam for the same Class, even in another Room", async () => {
    const s = await examSchool();
    await addExam(s.asAdmin, final(s.math7B.id, s.hall.id));

    await expect(
      addExam(s.asAdmin, final(s.science7B.id, s.lab.id, { startTime: "10:00", durationMinutes: 30 })),
    ).rejects.toThrow(ExamClashForClass);
  });

  it("refuses an Exam that overlaps another Exam in the same Room, even for another Class", async () => {
    const s = await examSchool();
    await addExam(s.asAdmin, final(s.math7A.id, s.hall.id));

    await expect(
      addExam(s.asAdmin, final(s.math7B.id, s.hall.id, { startTime: "08:00", durationMinutes: 61 })),
    ).rejects.toThrow(ExamClashForRoom);
  });

  it("refuses an Exam that sits entirely inside another", async () => {
    const s = await examSchool();
    await addExam(s.asAdmin, final(s.math7A.id, s.hall.id));

    await expect(
      addExam(s.asAdmin, final(s.math7B.id, s.hall.id, { startTime: "09:30", durationMinutes: 10 })),
    ).rejects.toThrow(ExamClashForRoom);
  });

  it("allows back-to-back Exams for the same Class in the same Room", async () => {
    const s = await examSchool();
    await addExam(s.asAdmin, final(s.math7B.id, s.hall.id)); // 09:00 to 10:30

    await addExam(s.asAdmin, final(s.science7B.id, s.hall.id, { startTime: "10:30" }));
    const before = await addExam(s.asAdmin, final(s.math7A.id, s.hall.id, { startTime: "08:00", durationMinutes: 60 }));

    expect(before.id).toEqual(expect.any(Number));
  });

  it("allows the same time on another date", async () => {
    const s = await examSchool();
    await addExam(s.asAdmin, final(s.math7B.id, s.hall.id));

    const other = await addExam(s.asAdmin, final(s.science7B.id, s.hall.id, { date: "2026-11-11" }));

    expect(other.id).toEqual(expect.any(Number));
  });

  it("allows different Classes in different Rooms at the same time", async () => {
    const s = await examSchool();
    await addExam(s.asAdmin, final(s.math7A.id, s.hall.id));

    const other = await addExam(s.asAdmin, final(s.math7B.id, s.lab.id));

    expect(other.id).toEqual(expect.any(Number));
  });

  it("creates no Assessment when the Exam is refused", async () => {
    const s = await examSchool();
    await addExam(s.asAdmin, final(s.math7A.id, s.hall.id));

    await expect(addExam(s.asAdmin, final(s.math7B.id, s.hall.id))).rejects.toThrow(ExamClashForRoom);

    expect(await listAssessments(s.asSara, { classSubjectId: s.math7B.id })).toEqual([]);
  });

  it("lets only one of many overlapping Exams through when they are added at the same moment", async () => {
    const s = await examSchool();
    // Open the pool's connections first, so the transactions really do interleave.
    await Promise.all(Array.from({ length: 8 }, () => s.app.deps.db.$client.query("select pg_sleep(0.05)")));

    const results = await Promise.allSettled(
      Array.from({ length: 8 }, (_, i) => addExam(s.asAdmin, final(i % 2 ? s.math7A.id : s.math7B.id, s.hall.id))),
    );

    const refused = results.filter((r) => r.status === "rejected");
    expect(refused).toHaveLength(7);
    for (const r of refused) {
      // A refused Exam for the winner's Class is a Class clash; the others are Room clashes.
      expect(["errors.examClashForClass", "errors.examClashForRoom"]).toContain(r.reason.messageKey);
    }
  });
});

describe("who may add an Exam, and what is refused", () => {
  it("refuses a Teacher, even the Class Subject's own Subject Teacher", async () => {
    const s = await examSchool();

    await expect(addExam(s.asSara, final(s.math7A.id, s.hall.id))).rejects.toThrow(AccessDenied);
  });

  it("refuses an unknown Class Subject or Room", async () => {
    const s = await examSchool();

    await expect(addExam(s.asAdmin, final(9999, s.hall.id))).rejects.toThrow(NotFound);
    await expect(addExam(s.asAdmin, final(Number.NaN, s.hall.id))).rejects.toThrow(NotFound);
    await expect(addExam(s.asAdmin, final(s.math7A.id, 9999))).rejects.toThrow(NotFound);
    await expect(addExam(s.asAdmin, final(s.math7A.id, Number.NaN))).rejects.toThrow(NotFound);

    expect(await listAssessments(s.asSara, { classSubjectId: s.math7A.id })).toEqual([]);
  });

  it.each([
    ["not a time", { startTime: "soon" }, "errors.examStartTimeInvalid"],
    ["an hour past the day", { startTime: "24:00" }, "errors.examStartTimeInvalid"],
    ["no minutes", { durationMinutes: 0 }, "errors.examDurationInvalid"],
    ["part of a minute", { durationMinutes: 1.5 }, "errors.examDurationInvalid"],
    ["running past midnight", { startTime: "23:00", durationMinutes: 61 }, "errors.examDurationInvalid"],
    ["a date outside the Academic Year", { date: "2027-07-01" }, "errors.assessmentDateOutsideYear"],
    ["a date that doesn't exist", { date: "2026-02-30" }, "errors.assessmentDateInvalid"],
    ["no maximum marks", { maxMarks: 0 }, "errors.assessmentMaxMarksInvalid"],
    ["no weight", { weight: 0 }, "errors.assessmentWeightInvalid"],
  ])("refuses %s", async (_name, over, messageKey) => {
    const s = await examSchool();

    await expect(addExam(s.asAdmin, final(s.math7A.id, s.hall.id, over))).rejects.toMatchObject({ messageKey });

    expect(await listAssessments(s.asSara, { classSubjectId: s.math7A.id })).toEqual([]);
  });

  it("allows an Exam that ends exactly at midnight", async () => {
    const s = await examSchool();

    const late = await addExam(s.asAdmin, final(s.math7A.id, s.hall.id, { startTime: "23:00", durationMinutes: 60 }));

    expect(late.id).toEqual(expect.any(Number));
  });
});

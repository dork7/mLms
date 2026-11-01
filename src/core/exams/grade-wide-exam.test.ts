import { describe, expect, it } from "vitest";
import { listAssessments } from "../assessments/assessments";
import { marksGrid, saveMarks } from "../assessments/marks";
import { assessmentSchool } from "../assessments/test-assessments";
import { createClassSubject } from "../classes/class-subjects";
import { createClass } from "../classes/classes";
import { AcademicYearClosed, AccessDenied, ExamClashForClass, ExamClashForRoom, NotFound } from "../errors";
import { createAcademicYear, listAcademicYears } from "../school/academic-year";
import { createGrade, createRoom } from "../school/catalogue";
import { closeAcademicYear } from "../year-end/year-end";
import { addExam, addGradeWideExam, examTimetable, gradeWideExamChoices } from "./exams";

/** Today is 2026-10-20. Grade 7 has 7-A and 7-B, both with Math (Sara). Two Rooms. */
async function examSchool() {
  const s = await assessmentSchool();
  const hall = await createRoom(s.asAdmin, { name: "Hall" });
  const lab = await createRoom(s.asAdmin, { name: "Lab" });
  const [year] = await listAcademicYears(s.asAdmin);
  /** Grade 7 Math final: 90 minutes at 09:00 on 2026-11-10, in Hall for 7-A and Lab for 7-B, unless overridden. */
  const grade7Math = (over: Partial<Parameters<typeof addGradeWideExam>[1]> = {}) => ({
    academicYearId: s.year.id,
    gradeId: s.grade7.id,
    subjectId: s.math.id,
    rooms: [
      { classSubjectId: s.math7A.id, roomId: hall.id },
      { classSubjectId: s.math7B.id, roomId: lab.id },
    ],
    type: "final" as const,
    date: "2026-11-10",
    startTime: "09:00",
    durationMinutes: 90,
    maxMarks: 100,
    weight: 3,
    ...over,
  });
  /** Nothing from a refused add: no Exam on the timetable and no Assessment for either Class. */
  const expectNothingAdded = async () => {
    const timetable = await examTimetable(s.asAdmin, { termId: year.terms[0].id });
    expect(timetable?.groups).toEqual([]);
    expect(await listAssessments(s.asSara, { classSubjectId: s.math7A.id })).toEqual([]);
    expect(await listAssessments(s.asSara, { classSubjectId: s.math7B.id })).toEqual([]);
  };
  return { ...s, hall, lab, term1: year.terms[0].id, grade7Math, expectNothingAdded };
}

describe("adding a grade-wide Exam", () => {
  it("adds one Exam per Class Subject, each in its own Room, shown together in the timetable", async () => {
    const s = await examSchool();

    const exams = await addGradeWideExam(s.asAdmin, s.grade7Math());

    expect(exams).toHaveLength(2);
    const timetable = await examTimetable(s.asAdmin, { termId: s.term1 });
    expect(timetable?.groups).toMatchObject([
      {
        grade: "Grade 7",
        subject: "Math",
        type: "final",
        date: "2026-11-10",
        startTime: "09:00",
        endTime: "10:30",
        exams: [
          { class: "7-A", room: "Hall", teacher: "Sara" },
          { class: "7-B", room: "Lab", teacher: "Sara" },
        ],
      },
    ]);
  });

  it("gives each Exam its own Assessment, so Marks are entered per Class in the normal grid", async () => {
    const s = await examSchool();

    const [exam7A, exam7B] = await addGradeWideExam(s.asAdmin, s.grade7Math());

    expect(exam7A.assessmentId).not.toBe(exam7B.assessmentId);
    expect(await listAssessments(s.asSara, { classSubjectId: s.math7A.id })).toMatchObject([
      { id: exam7A.assessmentId, type: "final", date: "2026-11-10", maxMarks: 100, weight: 3 },
    ]);
    expect(await listAssessments(s.asSara, { classSubjectId: s.math7B.id })).toMatchObject([
      { id: exam7B.assessmentId, type: "final", date: "2026-11-10", maxMarks: 100, weight: 3 },
    ]);
    await saveMarks(s.asSara, { assessmentId: exam7A.assessmentId, marks: [{ studentId: s.aisha, mark: 87 }] });
    const grid = await marksGrid(s.asSara, { assessmentId: exam7A.assessmentId });
    expect(grid.rows.find((r) => r.studentId === s.aisha)?.mark).toBe(87);
  });

  it("covers only that Grade, that Subject and that Academic Year, and skips a Class without the Subject", async () => {
    const s = await examSchool();
    const grade8 = await createGrade(s.asAdmin, { name: "Grade 8" });
    const class8A = await createClass(s.asAdmin, {
      academicYearId: s.year.id,
      gradeId: grade8.id,
      name: "8-A",
      classTeacherId: s.omar.userId,
    });
    await createClassSubject(s.asAdmin, { classId: class8A.id, subjectId: s.math.id, teacherId: s.omar.userId });
    const nextYear = await createAcademicYear(s.asAdmin, {
      name: "2027-2028",
      startDate: "2027-09-01",
      endDate: "2028-06-30",
      terms: [{ name: "Term 1", startDate: "2027-09-01", endDate: "2028-06-30" }],
    });
    const next7A = await createClass(s.asAdmin, {
      academicYearId: nextYear.id,
      gradeId: s.grade7.id,
      name: "7-A next",
      classTeacherId: s.omar.userId,
    });
    await createClassSubject(s.asAdmin, { classId: next7A.id, subjectId: s.math.id, teacherId: s.omar.userId });

    await addGradeWideExam(s.asAdmin, s.grade7Math());

    const timetable = await examTimetable(s.asAdmin, { termId: s.term1 });
    expect(timetable?.groups.flatMap((g) => g.exams.map((e) => e.class))).toEqual(["7-A", "7-B"]);

    // Science is only taught in 7-B, so its grade-wide Exam is that one Class.
    await addGradeWideExam(
      s.asAdmin,
      s.grade7Math({
        subjectId: s.science.id,
        rooms: [{ classSubjectId: s.science7B.id, roomId: s.lab.id }],
        startTime: "13:00",
      }),
    );
    const after = await examTimetable(s.asAdmin, { termId: s.term1 });
    expect(after?.groups.find((g) => g.subject === "Science")?.exams.map((e) => e.class)).toEqual(["7-B"]);
  });
});

describe("what can sit a grade-wide Exam", () => {
  it("lists each Grade's Subjects with the Classes that have them, in the Academic Year asked for", async () => {
    const s = await examSchool();

    const choices = await gradeWideExamChoices(s.asAdmin, { academicYearId: s.year.id });

    expect(choices).toEqual([
      {
        gradeId: s.grade7.id,
        grade: "Grade 7",
        subjectId: s.math.id,
        subject: "Math",
        classSubjects: [
          { id: s.math7A.id, class: "7-A" },
          { id: s.math7B.id, class: "7-B" },
        ],
      },
      {
        gradeId: s.grade7.id,
        grade: "Grade 7",
        subjectId: s.science.id,
        subject: "Science",
        classSubjects: [{ id: s.science7B.id, class: "7-B" }],
      },
    ]);
    await expect(gradeWideExamChoices(s.asSara, { academicYearId: s.year.id })).rejects.toThrow(AccessDenied);
  });
});

describe("a grade-wide Exam is all or nothing", () => {
  it("a Class clash in the last Class refuses the whole add, leaving no Exam or Assessment for the first", async () => {
    const s = await examSchool();
    const gym = await createRoom(s.asAdmin, { name: "Gym" });
    await addExam(s.asAdmin, {
      classSubjectId: s.science7B.id,
      roomId: gym.id,
      type: "quiz",
      date: "2026-11-10",
      startTime: "09:30",
      durationMinutes: 30,
      maxMarks: 10,
      weight: 1,
    });

    await expect(addGradeWideExam(s.asAdmin, s.grade7Math())).rejects.toThrow(ExamClashForClass);

    const timetable = await examTimetable(s.asAdmin, { termId: s.term1 });
    expect(timetable?.groups.map((g) => g.subject)).toEqual(["Science"]);
    expect(await listAssessments(s.asSara, { classSubjectId: s.math7A.id })).toEqual([]);
    expect(await listAssessments(s.asSara, { classSubjectId: s.math7B.id })).toEqual([]);
  });

  it("a Room clash with another Grade's Exam on the timetable refuses the whole add", async () => {
    const s = await examSchool();
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
    // 7-B's Room, Lab, is taken; 7-A's Exam would otherwise have been added first.
    await addExam(s.asAdmin, {
      classSubjectId: math8A.id,
      roomId: s.lab.id,
      type: "quiz",
      date: "2026-11-10",
      startTime: "10:00",
      durationMinutes: 30,
      maxMarks: 10,
      weight: 1,
    });

    await expect(addGradeWideExam(s.asAdmin, s.grade7Math())).rejects.toThrow(ExamClashForRoom);

    expect(await listAssessments(s.asSara, { classSubjectId: s.math7A.id })).toEqual([]);
    expect(await listAssessments(s.asSara, { classSubjectId: s.math7B.id })).toEqual([]);
  });

  it("two Classes given the same Room clash with each other, so the whole add is refused", async () => {
    const s = await examSchool();

    await expect(
      addGradeWideExam(
        s.asAdmin,
        s.grade7Math({
          rooms: [
            { classSubjectId: s.math7A.id, roomId: s.hall.id },
            { classSubjectId: s.math7B.id, roomId: s.hall.id },
          ],
        }),
      ),
    ).rejects.toThrow(ExamClashForRoom);

    await s.expectNothingAdded();
  });

  it("a later Exam that clashes with none, back to back, is still added", async () => {
    const s = await examSchool();
    await addGradeWideExam(s.asAdmin, s.grade7Math());

    await addGradeWideExam(s.asAdmin, s.grade7Math({ startTime: "10:30" }));

    const timetable = await examTimetable(s.asAdmin, { termId: s.term1 });
    expect(timetable?.groups).toHaveLength(2);
  });
});

describe("what a grade-wide Exam refuses", () => {
  it("a Teacher can't add one", async () => {
    const s = await examSchool();

    await expect(addGradeWideExam(s.asSara, s.grade7Math())).rejects.toThrow(AccessDenied);

    await s.expectNothingAdded();
  });

  it.each([
    ["a Class with no Room", (rooms: Room[]) => rooms.slice(0, 1)],
    ["a Room for a Class twice", (rooms: Room[]) => [rooms[0], rooms[0]]],
    ["a Room for a Class Subject outside the Exam", (rooms: Room[]) => [...rooms, { ...rooms[0], classSubjectId: -1 }]],
  ])("%s", async (_name, change) => {
    const s = await examSchool();

    await expect(addGradeWideExam(s.asAdmin, s.grade7Math({ rooms: change(s.grade7Math().rooms) }))).rejects.toMatchObject({
      messageKey: "errors.gradeExamRoomsMismatch",
    });

    await s.expectNothingAdded();
  });

  it("a Science Class Subject can't take a Room in a Math Exam", async () => {
    const s = await examSchool();

    await expect(
      addGradeWideExam(
        s.asAdmin,
        s.grade7Math({
          rooms: [
            { classSubjectId: s.math7A.id, roomId: s.hall.id },
            { classSubjectId: s.science7B.id, roomId: s.lab.id },
          ],
        }),
      ),
    ).rejects.toMatchObject({ messageKey: "errors.gradeExamRoomsMismatch" });
  });

  it("a Subject no Class of the Grade has", async () => {
    const s = await examSchool();

    await expect(
      addGradeWideExam(s.asAdmin, s.grade7Math({ gradeId: (await createGrade(s.asAdmin, { name: "Grade 9" })).id, rooms: [] })),
    ).rejects.toMatchObject({ messageKey: "errors.gradeExamNoClassSubjects" });
  });

  it("a Room that doesn't exist, after the first Class was fine", async () => {
    const s = await examSchool();

    await expect(
      addGradeWideExam(
        s.asAdmin,
        s.grade7Math({
          rooms: [
            { classSubjectId: s.math7A.id, roomId: s.hall.id },
            { classSubjectId: s.math7B.id, roomId: 99999 },
          ],
        }),
      ),
    ).rejects.toThrow(NotFound);

    await s.expectNothingAdded();
  });

  it.each([
    ["not a time", { startTime: "soon" }, "errors.examStartTimeInvalid"],
    ["running past midnight", { startTime: "23:00", durationMinutes: 61 }, "errors.examDurationInvalid"],
    ["a date outside the Academic Year", { date: "2027-07-01" }, "errors.assessmentDateOutsideYear"],
    ["no maximum marks", { maxMarks: 0 }, "errors.assessmentMaxMarksInvalid"],
  ])("%s", async (_name, over, messageKey) => {
    const s = await examSchool();

    await expect(addGradeWideExam(s.asAdmin, s.grade7Math(over))).rejects.toMatchObject({ messageKey });

    await s.expectNothingAdded();
  });

  it("a Closed Academic Year", async () => {
    const s = await examSchool();
    const nextYear = await createAcademicYear(s.asAdmin, {
      name: "2031-2032",
      startDate: "2031-09-01",
      endDate: "2032-06-30",
      terms: [{ name: "Term 1", startDate: "2031-09-01", endDate: "2032-06-30" }],
    });
    const closing = await createClass(s.asAdmin, {
      academicYearId: nextYear.id,
      gradeId: s.grade7.id,
      name: "7-closing",
      classTeacherId: s.omar.userId,
    });
    const math = await createClassSubject(s.asAdmin, {
      classId: closing.id,
      subjectId: s.math.id,
      teacherId: s.sara.userId,
    });
    await closeAcademicYear(s.asAdmin, { academicYearId: nextYear.id });

    await expect(
      addGradeWideExam(
        s.asAdmin,
        s.grade7Math({
          academicYearId: nextYear.id,
          date: "2031-11-10",
          rooms: [{ classSubjectId: math.id, roomId: s.hall.id }],
        }),
      ),
    ).rejects.toThrow(AcademicYearClosed);
  });
});

type Room = { classSubjectId: number; roomId: number };

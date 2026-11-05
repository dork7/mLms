import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { AccessDenied, ExamClashForClass, ExamClashForRoom, NotFound } from "../errors";
import { listAssessments } from "../assessments/assessments";
import { marksGrid, saveMarks } from "../assessments/marks";
import { assessmentSchool } from "../assessments/test-assessments";
import { createRoom } from "../school/catalogue";
import { listAcademicYears } from "../school/academic-year";
import { myExamCalendar, myExamSchedule } from "./exam-schedule";
import { addExam, deleteExam, examTimetable, getExam, rescheduleExam } from "./exams";

/** Today is 2026-10-20. Term 1 runs to 2026-12-31, Term 2 from 2027-01-01. Two Rooms. */
async function examSchool() {
  const s = await assessmentSchool();
  const hall = await createRoom(s.asAdmin, { name: "Hall" });
  const lab = await createRoom(s.asAdmin, { name: "Lab" });
  const [year] = await listAcademicYears(s.asAdmin);
  return { ...s, hall, lab, term1: year.terms[0].id, term2: year.terms[1].id };
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

/** When and where an Exam is sat: what `rescheduleExam` takes besides the Exam. */
const sitting = (roomId: number, over: Partial<{ date: string; startTime: string; durationMinutes: number }> = {}) => ({
  roomId,
  date: "2026-11-10",
  startTime: "09:00",
  durationMinutes: 90,
  ...over,
});

describe("rescheduling an Exam", () => {
  it("moves it to a new date, time, duration and Room, keeping its Assessment", async () => {
    const s = await examSchool();
    const exam = await addExam(s.asAdmin, final(s.math7A.id, s.hall.id));

    await rescheduleExam(s.asAdmin, {
      examId: exam.id,
      ...sitting(s.lab.id, { date: "2027-01-12", startTime: "13:30", durationMinutes: 60 }),
    });

    expect((await examTimetable(s.asAdmin, { termId: s.term1 }))?.groups).toEqual([]);
    expect((await examTimetable(s.asAdmin, { termId: s.term2 }))?.groups).toMatchObject([
      {
        date: "2027-01-12",
        startTime: "13:30",
        endTime: "14:30",
        durationMinutes: 60,
        exams: [{ id: exam.id, assessmentId: exam.assessmentId, class: "7-A", room: "Lab" }],
      },
    ]);
    expect(await listAssessments(s.asSara, { classSubjectId: s.math7A.id })).toMatchObject([
      { id: exam.assessmentId, date: "2027-01-12", term: "Term 2", type: "final", maxMarks: 100, weight: 3 },
    ]);
  });
  it("moves it in the Student's .ics too, as the same calendar event", async () => {
    const s = await examSchool();
    const exam = await addExam(s.asAdmin, final(s.math7A.id, s.hall.id));
    const asAisha = s.app.as({ role: "student", userId: s.aisha });

    await rescheduleExam(s.asAdmin, { examId: exam.id, ...sitting(s.lab.id, { startTime: "10:00" }) });

    // The school's Clock is in Asia/Dubai (UTC+4).
    const event = (await myExamCalendar(asAisha)).split("\r\n").filter((l) => /^(UID|DTSTART|LOCATION):/.test(l));
    expect(event).toEqual([`UID:exam-${exam.id}@school-lms`, "DTSTART:20261110T060000Z", "LOCATION:Lab"]);
  });
  it("moves it in the Subject Teacher's schedule too", async () => {
    const s = await examSchool();
    const exam = await addExam(s.asAdmin, final(s.math7A.id, s.hall.id));

    await rescheduleExam(s.asAdmin, { examId: exam.id, ...sitting(s.lab.id, { date: "2026-11-12", startTime: "10:00" }) });

    expect((await myExamSchedule(s.asSara)).exams).toMatchObject([
      { id: exam.id, date: "2026-11-12", startTime: "10:00", endTime: "11:30", class: "7-A", room: "Lab" },
    ]);
  });
});

describe("the clash rules after a reschedule", () => {
  it("refuses moving an Exam onto another Exam of its Class, and leaves it where it was", async () => {
    const s = await examSchool();
    await addExam(s.asAdmin, final(s.math7A.id, s.hall.id, { date: "2026-11-11" }));
    const exam = await addExam(s.asAdmin, final(s.math7A.id, s.hall.id));

    await expect(
      rescheduleExam(s.asAdmin, { examId: exam.id, ...sitting(s.lab.id, { date: "2026-11-11", startTime: "10:00" }) }),
    ).rejects.toThrow(ExamClashForClass);

    const groups = (await examTimetable(s.asAdmin, { termId: s.term1 }))?.groups;
    expect(groups?.map((g) => [g.date, g.startTime, g.exams.map((e) => e.room)])).toEqual([
      ["2026-11-10", "09:00", ["Hall"]],
      ["2026-11-11", "09:00", ["Hall"]],
    ]);
  });

  it("refuses moving an Exam into a Room another Class's Exam has at an overlapping time", async () => {
    const s = await examSchool();
    await addExam(s.asAdmin, final(s.math7B.id, s.lab.id));
    const exam = await addExam(s.asAdmin, final(s.math7A.id, s.hall.id));

    await expect(rescheduleExam(s.asAdmin, { examId: exam.id, ...sitting(s.lab.id) })).rejects.toThrow(
      ExamClashForRoom,
    );
  });

  it("doesn't count the Exam's own old sitting as a clash", async () => {
    const s = await examSchool();
    const exam = await addExam(s.asAdmin, final(s.math7A.id, s.hall.id));

    await rescheduleExam(s.asAdmin, { examId: exam.id, ...sitting(s.hall.id, { startTime: "09:30" }) });

    const groups = (await examTimetable(s.asAdmin, { termId: s.term1 }))?.groups;
    expect(groups?.map((g) => [g.startTime, g.endTime])).toEqual([["09:30", "11:00"]]);
  });

  it("allows moving an Exam back to back with another in the same Room", async () => {
    const s = await examSchool();
    await addExam(s.asAdmin, final(s.math7B.id, s.hall.id, { startTime: "11:00" }));
    const exam = await addExam(s.asAdmin, final(s.math7A.id, s.lab.id, { startTime: "08:00" }));

    await rescheduleExam(s.asAdmin, { examId: exam.id, ...sitting(s.hall.id, { startTime: "09:30" }) });

    const groups = (await examTimetable(s.asAdmin, { termId: s.term1 }))?.groups;
    expect(groups?.map((g) => [g.startTime, g.endTime, g.exams.map((e) => e.room)])).toEqual([
      ["09:30", "11:00", ["Hall"]],
      ["11:00", "12:30", ["Hall"]],
    ]);
  });
  it("lets only one of many Exams moved to the same sitting at the same moment through", async () => {
    const s = await examSchool();
    const exams = [];
    for (let day = 1; day <= 8; day++) {
      exams.push(await addExam(s.asAdmin, final(s.math7A.id, s.hall.id, { date: `2026-11-0${day}` })));
    }
    // Open the pool's connections first, so the transactions really do interleave.
    await Promise.all(Array.from({ length: 8 }, () => s.app.deps.db.$client.query("select pg_sleep(0.05)")));

    const results = await Promise.allSettled(
      exams.map((exam) => rescheduleExam(s.asAdmin, { examId: exam.id, ...sitting(s.hall.id, { date: "2026-11-20" }) })),
    );

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });
});

describe("an Exam with Marks", () => {
  it("keeps its date, so its roster, Term and leave exemptions stay right", async () => {
    const s = await examSchool();
    const exam = await addExam(s.asAdmin, final(s.math7A.id, s.hall.id));
    await saveMarks(s.asSara, { assessmentId: exam.assessmentId, marks: [{ studentId: s.aisha, mark: "absent" }] });

    await expect(
      rescheduleExam(s.asAdmin, { examId: exam.id, ...sitting(s.hall.id, { date: "2026-11-11" }) }),
    ).rejects.toMatchObject({ messageKey: "errors.examHasMarksDateFixed" });

    expect((await listAssessments(s.asSara, { classSubjectId: s.math7A.id }))[0].date).toBe("2026-11-10");
  });

  it("can still change its start time, duration and Room", async () => {
    const s = await examSchool();
    const exam = await addExam(s.asAdmin, final(s.math7A.id, s.hall.id));
    await saveMarks(s.asSara, { assessmentId: exam.assessmentId, marks: [{ studentId: s.aisha, mark: 87 }] });

    await rescheduleExam(s.asAdmin, {
      examId: exam.id,
      ...sitting(s.lab.id, { startTime: "10:00", durationMinutes: 120 }),
    });

    const groups = (await examTimetable(s.asAdmin, { termId: s.term1 }))?.groups;
    expect(groups?.map((g) => [g.date, g.startTime, g.endTime, g.exams.map((e) => e.room)])).toEqual([
      ["2026-11-10", "10:00", "12:00", ["Lab"]],
    ]);
  });
});

describe("what a reschedule refuses", () => {
  it("a Teacher, even the Exam's own Subject Teacher", async () => {
    const s = await examSchool();
    const exam = await addExam(s.asAdmin, final(s.math7A.id, s.hall.id));

    await expect(
      rescheduleExam(s.asSara, { examId: exam.id, ...sitting(s.hall.id, { startTime: "10:00" }) }),
    ).rejects.toThrow(AccessDenied);
  });

  it("an Exam or Room that doesn't exist", async () => {
    const s = await examSchool();
    const exam = await addExam(s.asAdmin, final(s.math7A.id, s.hall.id));

    await expect(rescheduleExam(s.asAdmin, { examId: 9999, ...sitting(s.hall.id) })).rejects.toThrow(NotFound);
    await expect(rescheduleExam(s.asAdmin, { examId: Number.NaN, ...sitting(s.hall.id) })).rejects.toThrow(NotFound);
    await expect(rescheduleExam(s.asAdmin, { examId: exam.id, ...sitting(9999) })).rejects.toThrow(NotFound);
    await expect(rescheduleExam(s.asAdmin, { examId: exam.id, ...sitting(Number.NaN) })).rejects.toThrow(NotFound);
  });

  it.each([
    ["not a time", { startTime: "soon" }, "errors.examStartTimeInvalid"],
    ["no minutes", { durationMinutes: 0 }, "errors.examDurationInvalid"],
    ["running past midnight", { startTime: "23:00", durationMinutes: 61 }, "errors.examDurationInvalid"],
    ["a date outside the Academic Year", { date: "2027-07-01" }, "errors.assessmentDateOutsideYear"],
    ["a date that doesn't exist", { date: "2026-02-30" }, "errors.assessmentDateInvalid"],
  ])("%s, leaving the Exam where it was", async (_name, over, messageKey) => {
    const s = await examSchool();
    const exam = await addExam(s.asAdmin, final(s.math7A.id, s.hall.id));

    await expect(rescheduleExam(s.asAdmin, { examId: exam.id, ...sitting(s.lab.id, over) })).rejects.toMatchObject({
      messageKey,
    });

    const groups = (await examTimetable(s.asAdmin, { termId: s.term1 }))?.groups;
    expect(groups?.map((g) => [g.date, g.startTime, g.endTime, g.exams.map((e) => e.room)])).toEqual([
      ["2026-11-10", "09:00", "10:30", ["Hall"]],
    ]);
  });
});

describe("deleting an Exam", () => {
  it("removes it from the timetable, and its Assessment from the Subject Teacher's list", async () => {
    const s = await examSchool();
    const kept = await addExam(s.asAdmin, final(s.math7B.id, s.lab.id));
    const exam = await addExam(s.asAdmin, final(s.math7A.id, s.hall.id));

    await deleteExam(s.asAdmin, { examId: exam.id });

    const groups = (await examTimetable(s.asAdmin, { termId: s.term1 }))?.groups;
    expect(groups?.flatMap((g) => g.exams.map((e) => e.id))).toEqual([kept.id]);
    expect(await listAssessments(s.asSara, { classSubjectId: s.math7A.id })).toEqual([]);
    expect(await listAssessments(s.asSara, { classSubjectId: s.math7B.id })).toMatchObject([{ id: kept.assessmentId }]);
  });

  it("frees its Class and Room for another Exam at that time", async () => {
    const s = await examSchool();
    const exam = await addExam(s.asAdmin, final(s.math7A.id, s.hall.id));

    await deleteExam(s.asAdmin, { examId: exam.id });

    await expect(addExam(s.asAdmin, final(s.math7A.id, s.hall.id))).resolves.toBeDefined();
  });

  it("refuses an Exam with Marks, even only an Absent one, until they are cleared", async () => {
    const s = await examSchool();
    const exam = await addExam(s.asAdmin, final(s.math7A.id, s.hall.id));
    await saveMarks(s.asSara, { assessmentId: exam.assessmentId, marks: [{ studentId: s.aisha, mark: "absent" }] });

    await expect(deleteExam(s.asAdmin, { examId: exam.id })).rejects.toMatchObject({ messageKey: "errors.examHasMarks" });
    expect(await listAssessments(s.asSara, { classSubjectId: s.math7A.id })).toHaveLength(1);

    await saveMarks(s.asSara, { assessmentId: exam.assessmentId, marks: [{ studentId: s.aisha, mark: null }] });
    await deleteExam(s.asAdmin, { examId: exam.id });
    expect(await listAssessments(s.asSara, { classSubjectId: s.math7A.id })).toEqual([]);
  });

  it("waits for a Mark save in flight, then refuses, so the Mark is kept", async () => {
    const s = await examSchool();
    const exam = await addExam(s.asAdmin, final(s.math7A.id, s.hall.id));
    const db = s.app.deps.db;

    // Holding the Assessment's row parks the save before it writes. No layer command can
    // pause there, so this is the one place a test touches a table (see publish.test.ts).
    let release = () => {};
    const released = new Promise<void>((resolve) => (release = resolve));
    const { promise: rowHeld, resolve: rowIsHeld } = Promise.withResolvers<void>();
    const holder = db.transaction(async (tx) => {
      await tx.execute(sql`select 1 from assessment where id = ${exam.assessmentId} for update`);
      rowIsHeld();
      await released;
    });
    await rowHeld;
    const waitingOnLocks = async () => {
      const { rows } = await db.execute(
        sql`select count(*)::int as n from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock'`,
      );
      return rows[0].n as number;
    };
    const until = async (done: () => Promise<boolean>) => {
      while (!(await done())) await new Promise((resolve) => setTimeout(resolve, 5));
    };

    const save = saveMarks(s.asSara, { assessmentId: exam.assessmentId, marks: [{ studentId: s.aisha, mark: 87 }] });
    await until(async () => (await waitingOnLocks()) >= 1);
    const deleting = deleteExam(s.asAdmin, { examId: exam.id }).then(
      () => "deleted",
      (err) => err.messageKey,
    );
    await until(async () => (await waitingOnLocks()) >= 2);
    release();
    await Promise.all([holder, save]);

    expect(await deleting).toBe("errors.examHasMarks");
    const grid = await marksGrid(s.asSara, { assessmentId: exam.assessmentId });
    expect(grid.rows.find((r) => r.studentId === s.aisha)?.mark).toBe(87);
  });

  it("refuses a Teacher, and an Exam that doesn't exist", async () => {
    const s = await examSchool();
    const exam = await addExam(s.asAdmin, final(s.math7A.id, s.hall.id));

    await expect(deleteExam(s.asSara, { examId: exam.id })).rejects.toThrow(AccessDenied);
    await expect(deleteExam(s.asAdmin, { examId: 9999 })).rejects.toThrow(NotFound);
    await expect(deleteExam(s.asAdmin, { examId: Number.NaN })).rejects.toThrow(NotFound);
    expect(await listAssessments(s.asSara, { classSubjectId: s.math7A.id })).toHaveLength(1);
  });
});

describe("one Exam, for its page", () => {
  it("has its sitting, what it's worth, and whether its date can still change", async () => {
    const s = await examSchool();
    const exam = await addExam(s.asAdmin, final(s.math7A.id, s.hall.id));

    expect(await getExam(s.asAdmin, { examId: exam.id })).toEqual({
      id: exam.id,
      assessmentId: exam.assessmentId,
      class: "7-A",
      subject: "Math",
      type: "final",
      maxMarks: 100,
      weight: 3,
      roomId: s.hall.id,
      date: "2026-11-10",
      startTime: "09:00",
      durationMinutes: 90,
      termId: s.term1,
      academicYear: { id: s.year.id, startDate: "2026-09-01", endDate: "2027-06-30", closed: false },
      hasMarks: false,
    });

    await saveMarks(s.asSara, { assessmentId: exam.assessmentId, marks: [{ studentId: s.aisha, mark: 87 }] });
    expect((await getExam(s.asAdmin, { examId: exam.id })).hasMarks).toBe(true);
  });

  it("is for the Admin only, and refuses an Exam that doesn't exist", async () => {
    const s = await examSchool();
    const exam = await addExam(s.asAdmin, final(s.math7A.id, s.hall.id));

    await expect(getExam(s.asSara, { examId: exam.id })).rejects.toThrow(AccessDenied);
    await expect(getExam(s.asAdmin, { examId: 9999 })).rejects.toThrow(NotFound);
  });
});

import { describe, expect, it } from "vitest";
import { assessmentSchool } from "../assessments/test-assessments";
import { reassignSubjectTeacher } from "../classes/class-subjects";
import { enrollStudent, moveStudent } from "../enrollment/enrollment";
import { AccessDenied } from "../errors";
import { createRoom } from "../school/catalogue";
import { registerStudent } from "../students/register-student";
import { yearEndSchool } from "../year-end/test-year-end";
import { closeAcademicYear, promoteClass } from "../year-end/year-end";
import { addExam } from "./exams";
import { myExamCalendar, myExamSchedule } from "./exam-schedule";

/** Today is 2026-10-20. Aisha and Bilal are in 7-A. Sara teaches Math in 7-A and 7-B, Huda Science in 7-B. */
async function examSchool() {
  const s = await assessmentSchool();
  const hall = await createRoom(s.asAdmin, { name: "Hall" });
  const lab = await createRoom(s.asAdmin, { name: "Lab" });
  const asAisha = s.app.as({ role: "student", userId: s.aisha });
  const student = async (name: string, studentNumber: string) => {
    const { studentId } = await registerStudent(s.asAdmin, {
      name,
      studentNumber,
      dateOfBirth: "2013-04-12",
      nationalId: `784-${studentNumber}`,
      guardianContact: "Guardian",
      admissionDate: "2026-08-25",
    });
    return studentId;
  };
  return { ...s, hall, lab, asAisha, student };
}

/** A 90-minute final at 09:00 on 2026-11-10, unless overridden. */
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

describe("a Student's Exam schedule", () => {
  it("shows the Exams for their current Class, when and where, and not another Class's", async () => {
    const s = await examSchool();
    const exam = await addExam(s.asAdmin, final(s.math7A.id, s.hall.id));
    await addExam(s.asAdmin, final(s.math7B.id, s.lab.id));

    const schedule = await myExamSchedule(s.asAisha);

    expect(schedule).toEqual({
      name: "Aisha Rahman",
      exams: [
        {
          id: exam.id,
          date: "2026-11-10",
          startTime: "09:00",
          endTime: "10:30",
          durationMinutes: 90,
          subject: "Math",
          type: "final",
          class: "7-A",
          room: "Hall",
        },
      ],
      pastExams: [],
    });
  });

  it("lists them in time order", async () => {
    const s = await examSchool();
    await addExam(s.asAdmin, final(s.math7A.id, s.hall.id, { date: "2026-11-12" }));
    await addExam(s.asAdmin, final(s.math7A.id, s.hall.id, { date: "2026-11-10", startTime: "11:00" }));
    await addExam(s.asAdmin, final(s.math7A.id, s.lab.id, { date: "2026-11-10", startTime: "08:00" }));

    const { exams } = await myExamSchedule(s.asAisha);

    expect(exams.map((e) => [e.date, e.startTime])).toEqual([
      ["2026-11-10", "08:00"],
      ["2026-11-10", "11:00"],
      ["2026-11-12", "09:00"],
    ]);
  });

  it("follows the Student when they move Class: the old Class's Exams drop off", async () => {
    const s = await examSchool();
    await addExam(s.asAdmin, final(s.math7A.id, s.hall.id));
    await addExam(s.asAdmin, final(s.math7B.id, s.lab.id));
    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-11-01" });

    expect((await myExamSchedule(s.asAisha)).exams.map((e) => e.class)).toEqual(["7-A"]);

    s.app.clock.set("2026-11-01T08:00:00+04:00");

    expect((await myExamSchedule(s.asAisha)).exams.map((e) => e.class)).toEqual(["7-B"]);
  });

  it("is empty for a Student whose Enrollment hasn't started", async () => {
    const s = await examSchool();
    const asCara = s.app.as({ role: "student", userId: await s.student("Cara Lee", "S-3") });
    await enrollStudent(s.asAdmin, { studentId: asCara.actor.userId, classId: s.class7A.id, startDate: "2026-11-01" });
    await addExam(s.asAdmin, final(s.math7A.id, s.hall.id));

    expect((await myExamSchedule(asCara)).exams).toEqual([]);
  });
});

describe("a Student's past Exams", () => {
  it("are the Exams from an earlier Enrollment, sat while they were enrolled, apart from the main schedule", async () => {
    const s = await examSchool();
    const sat = await addExam(s.asAdmin, final(s.math7A.id, s.hall.id, { date: "2026-09-25" }));
    await addExam(s.asAdmin, final(s.math7A.id, s.hall.id)); // 7-A's, but after she left
    await addExam(s.asAdmin, final(s.math7B.id, s.lab.id));
    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-10-01" });

    const schedule = await myExamSchedule(s.asAisha);

    expect(schedule.exams.map((e) => e.class)).toEqual(["7-B"]);
    expect(schedule.pastExams).toEqual([
      {
        id: sat.id,
        date: "2026-09-25",
        startTime: "09:00",
        endTime: "10:30",
        durationMinutes: 90,
        subject: "Math",
        type: "final",
        class: "7-A",
        room: "Hall",
      },
    ]);
  });

  it("are newest first", async () => {
    const s = await examSchool();
    await addExam(s.asAdmin, final(s.math7A.id, s.hall.id, { date: "2026-09-20" }));
    await addExam(s.asAdmin, final(s.math7A.id, s.hall.id, { date: "2026-09-25" }));
    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-10-01" });

    expect((await myExamSchedule(s.asAisha)).pastExams.map((e) => e.date)).toEqual(["2026-09-25", "2026-09-20"]);
  });

  it("are empty while the Student is still in their first Class, whose past-dated Exams stay on the main schedule", async () => {
    const s = await examSchool();
    await addExam(s.asAdmin, final(s.math7A.id, s.hall.id, { date: "2026-09-25" }));

    const schedule = await myExamSchedule(s.asAisha);

    expect(schedule.exams.map((e) => e.date)).toEqual(["2026-09-25"]);
    expect(schedule.pastExams).toEqual([]);
  });

  it("don't repeat an Exam on the main schedule when the Student came back to the Class", async () => {
    const s = await examSchool();
    await addExam(s.asAdmin, final(s.math7A.id, s.hall.id, { date: "2026-09-25" }));
    const in7B = await addExam(s.asAdmin, final(s.math7B.id, s.lab.id, { date: "2026-10-05" }));
    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-10-01" });
    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7A.id, date: "2026-10-10" });

    const schedule = await myExamSchedule(s.asAisha);

    expect(schedule.exams.map((e) => e.date)).toEqual(["2026-09-25"]);
    expect(schedule.pastExams.map((e) => e.id)).toEqual([in7B.id]);
  });

  it("only ever show the Student's own Enrollments", async () => {
    const s = await examSchool();
    await addExam(s.asAdmin, final(s.math7A.id, s.hall.id, { date: "2026-09-25" }));
    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-10-01" });

    const asBilal = s.app.as({ role: "student", userId: s.bilal });

    expect((await myExamSchedule(asBilal)).pastExams).toEqual([]);
  });

  it("stay viewable after the year is Closed, and a Leaving Student keeps theirs", async () => {
    const s = await yearEndSchool();
    const hall = await createRoom(s.asAdmin, { name: "Hall" });
    await addExam(s.asAdmin, final(s.math7A.id, hall.id, { date: "2026-11-10" }));
    await promoteClass(s.asAdmin, { classId: s.class7A.id, toClassId: s.class8A.id, leaving: [{ studentId: s.bilal }] });
    await closeAcademicYear(s.asAdmin, { academicYearId: s.year.id });
    s.app.clock.set("2027-10-01T08:00:00+04:00");

    const promoted = await myExamSchedule(s.app.as({ role: "student", userId: s.aisha }));
    const left = await myExamSchedule(s.app.as({ role: "student", userId: s.bilal }));

    expect(promoted.exams).toEqual([]);
    expect(promoted.pastExams.map((e) => e.class)).toEqual(["7-A"]);
    expect(left.exams).toEqual([]);
    expect(left.pastExams.map((e) => e.class)).toEqual(["7-A"]);
  });

  it("stay out of the .ics export", async () => {
    const s = await examSchool();
    const past = await addExam(s.asAdmin, final(s.math7A.id, s.hall.id, { date: "2026-09-25" }));
    const current = await addExam(s.asAdmin, final(s.math7B.id, s.lab.id));
    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-10-01" });

    const calendar = await myExamCalendar(s.asAisha);

    expect(calendar).toContain(`exam-${current.id}@school-lms`);
    expect(calendar).not.toContain(`exam-${past.id}@school-lms`);
  });

  it("don't apply to a Teacher", async () => {
    const s = await examSchool();
    await addExam(s.asAdmin, final(s.math7A.id, s.hall.id, { date: "2026-09-25" }));

    expect((await myExamSchedule(s.asSara)).pastExams).toEqual([]);
  });
});

describe("a Teacher's Exam schedule", () => {
  it("shows the Exams for the Class Subjects they teach, across Classes", async () => {
    const s = await examSchool();
    await addExam(s.asAdmin, final(s.math7A.id, s.hall.id));
    await addExam(s.asAdmin, final(s.math7B.id, s.lab.id));
    await addExam(s.asAdmin, final(s.science7B.id, s.lab.id, { date: "2026-11-11" }));

    const schedule = await myExamSchedule(s.asSara);

    expect(schedule.name).toBe("Sara");
    expect(schedule.exams.map((e) => [e.subject, e.class])).toEqual([
      ["Math", "7-A"],
      ["Math", "7-B"],
    ]);
  });

  it("leaves out Exams of a Class they are only the Class Teacher of", async () => {
    const s = await examSchool();
    await addExam(s.asAdmin, final(s.math7A.id, s.hall.id));
    await addExam(s.asAdmin, final(s.science7B.id, s.lab.id));

    const schedule = await myExamSchedule(s.asHuda);

    expect(schedule.exams.map((e) => [e.subject, e.class])).toEqual([["Science", "7-B"]]);
  });

  it("moves with the Class Subject when its Subject Teacher is changed", async () => {
    const s = await examSchool();
    await addExam(s.asAdmin, final(s.math7A.id, s.hall.id));

    await reassignSubjectTeacher(s.asAdmin, { classSubjectId: s.math7A.id, teacherId: s.omar.userId });

    expect((await myExamSchedule(s.asSara)).exams).toEqual([]);
    expect((await myExamSchedule(s.asOmar)).exams.map((e) => e.class)).toEqual(["7-A"]);
  });
});

describe("who has an Exam schedule", () => {
  it("refuses the Admin, who has the whole timetable instead", async () => {
    const s = await examSchool();

    await expect(myExamSchedule(s.asAdmin)).rejects.toThrow(AccessDenied);
    await expect(myExamCalendar(s.asAdmin)).rejects.toThrow(AccessDenied);
  });
});

/** The .ics file's logical lines: unfolded, as a calendar app reads them. */
const lines = (ics: string) => ics.replace(/\r\n /g, "").split("\r\n");

describe("the .ics export", () => {
  it("is a calendar of the viewer's own Exams, at the right instant in the school's time zone", async () => {
    const s = await examSchool();
    const exam = await addExam(s.asAdmin, final(s.math7A.id, s.hall.id));
    await addExam(s.asAdmin, final(s.math7B.id, s.lab.id));

    const ics = await myExamCalendar(s.asAisha);

    // The fixture's Clock is in Asia/Dubai (UTC+4) and reads 08:00 on 2026-10-20.
    expect(ics).toBe(
      [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//School LMS//Exam schedule//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        `UID:exam-${exam.id}@school-lms`,
        "DTSTAMP:20261020T040000Z",
        "DTSTART:20261110T050000Z",
        "DTEND:20261110T063000Z",
        "SUMMARY:Math Final (7-A)",
        "LOCATION:Hall",
        "END:VEVENT",
        "END:VCALENDAR",
        "",
      ].join("\r\n"),
    );
  });

  it("contains only a Teacher's own Exams", async () => {
    const s = await examSchool();
    await addExam(s.asAdmin, final(s.math7A.id, s.hall.id));
    await addExam(s.asAdmin, final(s.science7B.id, s.lab.id));

    const summaries = lines(await myExamCalendar(s.asHuda)).filter((l) => l.startsWith("SUMMARY:"));

    expect(summaries).toEqual(["SUMMARY:Science Final (7-B)"]);
  });

  it("ends an Exam that runs to midnight on the stroke of the next day", async () => {
    const s = await examSchool();
    await addExam(s.asAdmin, final(s.math7A.id, s.hall.id, { startTime: "23:00", durationMinutes: 60 }));

    const event = lines(await myExamCalendar(s.asAisha));

    expect(event).toContain("DTSTART:20261110T190000Z");
    expect(event).toContain("DTEND:20261110T200000Z");
  });

  it("escapes names, so a Room's name can't break the file or add to it", async () => {
    const s = await examSchool();
    const room = await createRoom(s.asAdmin, { name: "Hall, Block; A\\B\r\nBEGIN:VEVENT" });
    await addExam(s.asAdmin, final(s.math7A.id, room.id));

    const event = lines(await myExamCalendar(s.asAisha));

    expect(event).toContain("LOCATION:Hall\\, Block\\; A\\\\B\\nBEGIN:VEVENT");
    expect(event.filter((l) => l === "BEGIN:VEVENT")).toHaveLength(1);
  });

  it("folds long lines at 75 octets without splitting a character", async () => {
    const s = await examSchool();
    const name = "قاعة".repeat(30);
    const room = await createRoom(s.asAdmin, { name });
    await addExam(s.asAdmin, final(s.math7A.id, room.id));

    const ics = await myExamCalendar(s.asAisha);

    for (const line of ics.split("\r\n")) {
      expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
      expect(line).not.toContain("\uFFFD");
    }
    expect(lines(ics)).toContain(`LOCATION:${name}`);
  });
});

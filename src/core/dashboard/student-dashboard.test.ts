import { describe, expect, it } from "vitest";
import { createAssessment } from "../assessments/assessments";
import { saveMarks } from "../assessments/marks";
import { assessmentSchool, quiz } from "../assessments/test-assessments";
import { moveStudent } from "../enrollment/enrollment";
import { AccessDenied } from "../errors";
import { addExam } from "../exams/exams";
import { createRoom } from "../school/catalogue";
import { getStudentDashboard } from "./student-dashboard";

/** Today 2026-10-20, 08:00 at the school. Aisha and Bilal are in 7-A. Sara teaches Math in 7-A and 7-B. */
async function studentSchool() {
  const s = await assessmentSchool();
  const hall = await createRoom(s.asAdmin, { name: "Hall" });
  const asAisha = s.app.as({ role: "student", userId: s.aisha });
  const exam = (classSubjectId: number, date: string, startTime = "09:00") =>
    addExam(s.asAdmin, {
      classSubjectId,
      roomId: hall.id,
      type: "final",
      date,
      startTime,
      durationMinutes: 90,
      maxMarks: 100,
      weight: 3,
    });
  return { ...s, asAisha, exam };
}

describe("Student dashboard", () => {
  it("is refused to the Admin and to a Teacher", async () => {
    const s = await studentSchool();

    await expect(getStudentDashboard(s.asAdmin)).rejects.toThrow(AccessDenied);
    await expect(getStudentDashboard(s.asSara)).rejects.toThrow(AccessDenied);
  });
});

describe("the next Exam on the Student dashboard", () => {
  it("is null with no Exams", async () => {
    const s = await studentSchool();

    expect((await getStudentDashboard(s.asAisha)).nextExam).toBeNull();
  });

  it("is the soonest one still to start, when and where", async () => {
    const s = await studentSchool();
    await s.exam(s.math7A.id, "2026-10-01");
    const soon = await s.exam(s.math7A.id, "2026-11-10");
    await s.exam(s.math7A.id, "2026-12-10");

    expect((await getStudentDashboard(s.asAisha)).nextExam).toMatchObject({
      id: soon.id,
      date: "2026-11-10",
      startTime: "09:00",
      endTime: "10:30",
      subject: "Math",
      room: "Hall",
    });
  });

  it("moves on once an Exam starts, on the school's clock, and is null after the last", async () => {
    const s = await studentSchool();
    const first = await s.exam(s.math7A.id, "2026-10-20", "09:00");
    const second = await s.exam(s.math7A.id, "2026-10-20", "11:00");
    const next = async () => (await getStudentDashboard(s.asAisha)).nextExam?.id ?? null;

    s.app.clock.set("2026-10-20T08:59:00+04:00");
    expect(await next()).toBe(first.id);
    s.app.clock.set("2026-10-20T09:00:00+04:00");
    expect(await next()).toBe(first.id);
    s.app.clock.set("2026-10-20T09:01:00+04:00");
    expect(await next()).toBe(second.id);
    s.app.clock.set("2026-10-20T11:01:00+04:00");
    expect(await next()).toBeNull();
  });

  it("is from the Class the Student is enrolled in today, not an earlier one", async () => {
    const s = await studentSchool();
    await s.exam(s.math7A.id, "2026-11-10");
    const in7B = await s.exam(s.math7B.id, "2026-11-20");

    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-10-10" });

    expect((await getStudentDashboard(s.asAisha)).nextExam?.id).toBe(in7B.id);
  });
});

describe("the latest Marks on the Student dashboard", () => {
  const latest = async (s: Awaited<ReturnType<typeof studentSchool>>) =>
    (await getStudentDashboard(s.asAisha)).latestMarks;

  it("shows entered Marks newest first, leaving out Assessments with none yet", async () => {
    const s = await studentSchool();
    const older = await createAssessment(s.asSara, quiz(s.math7A.id, { date: "2026-09-10" }));
    const newer = await createAssessment(s.asSara, quiz(s.math7A.id, { date: "2026-09-20" }));
    await createAssessment(s.asSara, quiz(s.math7A.id, { date: "2026-09-30" }));
    await saveMarks(s.asSara, { assessmentId: older.id, marks: [{ studentId: s.aisha, mark: 5 }] });
    await saveMarks(s.asSara, { assessmentId: newer.id, marks: [{ studentId: s.aisha, mark: 8 }] });

    expect((await latest(s)).map((m) => [m.assessmentId, m.mark, m.percent])).toEqual([
      [newer.id, 8, 80],
      [older.id, 5, 50],
    ]);
  });

  it("shows Absent and Exempt, which are Marks too", async () => {
    const s = await studentSchool();
    const absent = await createAssessment(s.asSara, quiz(s.math7A.id, { date: "2026-09-20" }));
    const exempt = await createAssessment(s.asSara, quiz(s.math7A.id, { date: "2026-09-10" }));
    await saveMarks(s.asSara, { assessmentId: absent.id, marks: [{ studentId: s.aisha, mark: "absent" }] });
    await saveMarks(s.asSara, { assessmentId: exempt.id, marks: [{ studentId: s.aisha, mark: "exempt" }] });

    expect((await latest(s)).map((m) => m.mark)).toEqual(["absent", "exempt"]);
  });

  it("shows no more than the five latest", async () => {
    const s = await studentSchool();
    for (const day of ["01", "02", "03", "04", "05", "06"]) {
      const { id } = await createAssessment(s.asSara, quiz(s.math7A.id, { date: `2026-10-${day}` }));
      await saveMarks(s.asSara, { assessmentId: id, marks: [{ studentId: s.aisha, mark: 5 }] });
    }

    expect((await latest(s)).map((m) => m.date)).toEqual([
      "2026-10-06",
      "2026-10-05",
      "2026-10-04",
      "2026-10-03",
      "2026-10-02",
    ]);
  });

  it("keeps a Mark from the Student's earlier Class, and never shows another Student's", async () => {
    const s = await studentSchool();
    const { id } = await createAssessment(s.asSara, quiz(s.math7A.id));
    await saveMarks(s.asSara, {
      assessmentId: id,
      marks: [
        { studentId: s.aisha, mark: 8 },
        { studentId: s.bilal, mark: 3 },
      ],
    });

    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-10-10" });

    expect((await latest(s)).map((m) => [m.class, m.mark])).toEqual([["7-A", 8]]);
  });
});

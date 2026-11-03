import { describe, expect, it } from "vitest";
import { logIn } from "../accounts/log-in";
import { createAssessment } from "../assessments/assessments";
import { saveMarks } from "../assessments/marks";
import { assessmentSchool, quiz } from "../assessments/test-assessments";
import { getStudentDashboard } from "../dashboard/student-dashboard";
import { AccessDenied } from "../errors";
import { myExamSchedule } from "../exams/exam-schedule";
import { addExam } from "../exams/exams";
import { publishReportCards, studentReportCards } from "../report-cards/publish";
import { classReportCards } from "../report-cards/report-cards";
import { createRoom } from "../school/catalogue";
import { resetStudentPassword } from "../students/reset-student-password";
import { createFee } from "./fees";
import { feeAlerts, studentFeeAlert } from "./fee-alert";
import { applyFeeToStudents, getFee, studentFeeAssignments, unwaiveFeeAssignment, waiveFeeAssignment } from "./fee-assignments";
import { logPaymentRecord } from "./payment-records";
import { feesSchool } from "./test-fees";

const overdueOf = (rows: { fee: { name: string }; overdue: boolean }[]) => rows.map((a) => [a.fee.name, a.overdue]);

describe("Overdue", () => {
  it("a Fee Assignment becomes Overdue the day after its due date, by the Clock", async () => {
    const s = await feesSchool(); // today 2026-10-01
    const { id: feeId } = await s.newFee({ name: "Term 1 Tuition", dueDate: "2026-10-15" });
    await applyFeeToStudents(s.asAdmin, { feeId, studentIds: [s.aisha] });
    const read = async () => overdueOf(await studentFeeAssignments(s.asAdmin, { studentId: s.aisha }));

    expect(await read()).toEqual([["Term 1 Tuition", false]]);
    s.app.clock.set("2026-10-15T23:00:00+04:00");
    expect(await read()).toEqual([["Term 1 Tuition", false]]);
    s.app.clock.set("2026-10-16T08:00:00+04:00");
    expect(await read()).toEqual([["Term 1 Tuition", true]]);
  });
});

type School = Awaited<ReturnType<typeof feesSchool>>;

/** A Fee owed by the given Students; returns each one's Fee Assignment id by Student. */
async function owed(s: School, studentIds: string[], over: Parameters<School["newFee"]>[0] = {}) {
  const { id: feeId } = await s.newFee(over);
  await applyFeeToStudents(s.asAdmin, { feeId, studentIds });
  const { assignments } = await getFee(s.asAdmin, { feeId });
  return Object.fromEntries(assignments.map((a) => [a.studentId, a.id]));
}

const pay = (s: School, feeAssignmentId: number, amount: string) =>
  logPaymentRecord(s.asAdmin, { feeAssignmentId, amount, date: "2026-10-01", method: "cash", reference: "" });

const alertNames = async (s: School, studentId: string) =>
  (await studentFeeAlert(s.asAdmin, { studentId }))?.overdue.map((a) => a.fee.name) ?? null;

describe("the Fee Alert", () => {
  it("appears once a Fee Assignment is Overdue, naming it, and only for that Student", async () => {
    const s = await feesSchool(); // today 2026-10-01
    await owed(s, [s.aisha], { name: "Bus", dueDate: "2026-09-20" });
    await owed(s, [s.aisha, s.bilal], { name: "Term 1 Tuition", dueDate: "2026-10-15" });

    expect(await alertNames(s, s.aisha)).toEqual(["Bus"]);
    expect(await alertNames(s, s.bilal)).toBeNull();

    s.app.clock.set("2026-10-16T08:00:00+04:00");

    expect(await alertNames(s, s.aisha)).toEqual(["Bus", "Term 1 Tuition"]);
    expect(await alertNames(s, s.bilal)).toEqual(["Term 1 Tuition"]);
    expect(await alertNames(s, s.chen)).toBeNull();
  });

  it("stays while an Overdue Fee is Partially Paid and goes once it's Paid", async () => {
    const s = await feesSchool();
    const ids = await owed(s, [s.aisha], { amount: "1,000", dueDate: "2026-09-20" });

    await pay(s, ids[s.aisha], "400");
    expect(await alertNames(s, s.aisha)).toEqual(["Term 1 Tuition"]);

    await pay(s, ids[s.aisha], "600");
    expect(await alertNames(s, s.aisha)).toBeNull();
  });

  it("goes when the Overdue Fee Assignment is waived, and comes back when the waiver is undone", async () => {
    const s = await feesSchool();
    const ids = await owed(s, [s.aisha], { dueDate: "2026-09-20" });

    await waiveFeeAssignment(s.asAdmin, { feeAssignmentId: ids[s.aisha] });
    expect(await alertNames(s, s.aisha)).toBeNull();

    await unwaiveFeeAssignment(s.asAdmin, { feeAssignmentId: ids[s.aisha] });
    expect(await alertNames(s, s.aisha)).toEqual(["Term 1 Tuition"]);
  });
});

describe("Who gets the Fee Alert", () => {
  it("the Admin and the Student themselves get it, and a Student is refused another Student's", async () => {
    const s = await feesSchool();
    await owed(s, [s.aisha, s.bilal], { dueDate: "2026-09-20" });

    const own = await studentFeeAlert(s.asStudent(s.aisha), { studentId: s.aisha });

    expect(own).toEqual(await studentFeeAlert(s.asAdmin, { studentId: s.aisha }));
    expect(own?.overdue.map((a) => [a.studentName, a.fee.name, a.status])).toEqual([
      ["Aisha Rahman", "Term 1 Tuition", "unpaid"],
    ]);
    await expect(studentFeeAlert(s.asStudent(s.aisha), { studentId: s.bilal })).rejects.toThrow(AccessDenied);
    await expect(feeAlerts(s.asStudent(s.aisha), { studentIds: [s.aisha, s.bilal] })).rejects.toThrow(AccessDenied);
  });

  it("the Admin gets several Students' Fee Alerts at once, leaving out those with nothing Overdue", async () => {
    const s = await feesSchool();
    await owed(s, [s.bilal, s.chen], { dueDate: "2026-09-20" });

    const alerts = await feeAlerts(s.asAdmin, { studentIds: [s.chen, s.aisha, s.bilal] });

    expect(alerts.map((a) => [a.studentId, a.overdue.length])).toEqual([
      [s.chen, 1],
      [s.bilal, 1],
    ]);
    expect(await feeAlerts(s.asAdmin, { studentIds: [] })).toEqual([]);
  });

  it("Teachers, including the Student's Class Teacher, are refused the Fee Alert", async () => {
    const s = await feesSchool(); // Huda is Aisha's Class Teacher; Sara teaches her Math
    await owed(s, [s.aisha], { dueDate: "2026-09-20" });

    for (const teacher of [s.huda, s.sara]) {
      await expect(studentFeeAlert(s.app.as(teacher), { studentId: s.aisha })).rejects.toThrow(AccessDenied);
      await expect(feeAlerts(s.app.as(teacher), { studentIds: [s.aisha] })).rejects.toThrow(AccessDenied);
      await expect(feeAlerts(s.app.as(teacher), { studentIds: [] })).rejects.toThrow(AccessDenied);
    }
  });
});

describe("An Overdue Fee never blocks anything", () => {
  it("a Student with an Overdue Fee still logs in, sees their Exams and gets their Published Report Card", async () => {
    const s = await assessmentSchool(); // today 2026-10-20; Aisha in 7-A, Math by Sara
    const { id: feeId } = await createFee(s.asAdmin, { name: "Term 1 Tuition", amount: "1,000", dueDate: "2026-09-30" });
    await applyFeeToStudents(s.asAdmin, { feeId, studentIds: [s.aisha] });
    const asAisha = s.app.as({ role: "student", userId: s.aisha });
    expect(await studentFeeAlert(asAisha, { studentId: s.aisha })).not.toBeNull();

    const { newPassword } = await resetStudentPassword(s.asAdmin, { studentId: s.aisha });
    const session = await logIn(s.app.deps, { identifier: "S-1", password: newPassword });
    expect(session.actor).toEqual({ role: "student", userId: s.aisha });

    const hall = await createRoom(s.asAdmin, { name: "Hall" });
    await addExam(s.asAdmin, {
      classSubjectId: s.math7A.id,
      roomId: hall.id,
      type: "final",
      date: "2026-11-10",
      startTime: "09:00",
      durationMinutes: 90,
      maxMarks: 100,
      weight: 3,
    });
    expect((await myExamSchedule(asAisha)).exams.map((e) => e.date)).toEqual(["2026-11-10"]);
    expect((await getStudentDashboard(asAisha)).nextExam).toMatchObject({ date: "2026-11-10" });

    const { id: assessmentId } = await createAssessment(s.asSara, quiz(s.math7A.id));
    await saveMarks(s.asSara, { assessmentId, marks: [{ studentId: s.aisha, mark: 8 }] });
    const { terms } = await classReportCards(s.asAdmin, { classId: s.class7A.id });
    await publishReportCards(s.asAdmin, { classId: s.class7A.id, termId: terms[0].id });
    expect(await studentReportCards(asAisha, { studentId: s.aisha })).toEqual([
      expect.objectContaining({ studentId: s.aisha, overallPercent: 80 }),
    ]);
  });
});

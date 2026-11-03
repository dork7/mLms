// Student leave (ticket 22). A Student asks to be away for a date range; their current
// Class Teacher approves or rejects it, and the Admin can override. Approval turns the
// Student's Absent Marks on Assessments in the leave dates into Exempt.
//
//   `assessmentSchool()`: today 2026-10-20, Term 1 2026-09-01..2026-12-31, Term 2 2027.
//   7-A: Class Teacher Huda, Math taught by Sara. Aisha and Bilal in 7-A from day one.
//   7-B: Class Teacher Omar.
import { describe, expect, it } from "vitest";
import { createAssessment } from "../assessments/assessments";
import { type MarkValue, saveMarks, studentAssessmentHistory } from "../assessments/marks";
import { assessmentSchool, quiz } from "../assessments/test-assessments";
import { moveStudent } from "../enrollment/enrollment";
import { AccessDenied, LeaveDecidedByAdmin } from "../errors";
import { publishReportCards, unpublishReportCards } from "../report-cards/publish";
import { classReportCards } from "../report-cards/report-cards";
import {
  classLeaveRequests,
  decideLeaveRequest,
  getLeaveAttachment,
  myLeaveRequests,
  studentLeaveRequests,
  submitLeaveRequest,
  teacherLeaveRequests,
} from "./leave-requests";

type School = Awaited<ReturnType<typeof assessmentSchool>>;

const pdf = { fileName: "doctor.pdf", data: new Uint8Array([...Buffer.from("%PDF-1.7\n1 0 obj")]) };
const fever = { startDate: "2026-10-05", endDate: "2026-10-07", reason: "Fever" };

async function leaveSchool() {
  const s = await assessmentSchool();
  return { ...s, asAisha: s.app.as({ role: "student", userId: s.aisha }) };
}

/** A Math 7-A quiz on `date`, with these Marks entered by Sara, the Subject Teacher. */
async function quizOn(s: School, date: string, marks: Record<string, MarkValue>) {
  const { id } = await createAssessment(s.asSara, quiz(s.math7A.id, { date }));
  await saveMarks(s.asSara, {
    assessmentId: id,
    marks: Object.entries(marks).map(([studentId, mark]) => ({ studentId, mark })),
  });
  return id;
}

/** Aisha's Marks by Assessment date, oldest first, as the Admin sees them. */
async function aishasMarks(s: School): Promise<Record<string, MarkValue>> {
  const rows = await studentAssessmentHistory(s.asAdmin, { studentId: s.aisha });
  return Object.fromEntries(rows.reverse().map((r) => [r.date, r.mark]));
}

describe("A Student's Leave Request", () => {
  it("a Student submits a Leave Request with an attachment and sees it pending", async () => {
    const s = await leaveSchool();

    const { id } = await submitLeaveRequest(s.asAisha, { ...fever, attachment: pdf });

    expect(await myLeaveRequests(s.asAisha)).toMatchObject([
      {
        id,
        requester: "Aisha Rahman",
        startDate: "2026-10-05",
        endDate: "2026-10-07",
        reason: "Fever",
        attachment: { fileName: "doctor.pdf" },
        status: "pending",
        decidedBy: null,
      },
    ]);
    expect(await getLeaveAttachment(s.asAisha, { leaveRequestId: id })).toMatchObject({ fileName: "doctor.pdf" });
  });
});

describe("Deciding a Student's Leave Request", () => {
  it("the Student's Class Teacher approves it, and the Student sees who approved it and when", async () => {
    const s = await leaveSchool();
    const { id } = await submitLeaveRequest(s.asAisha, fever);

    s.app.clock.set("2026-10-21T10:00:00+04:00");
    await decideLeaveRequest(s.asHuda, { leaveRequestId: id, decision: "approved" });

    expect(await myLeaveRequests(s.asAisha)).toMatchObject([
      { id, status: "approved", decidedBy: "Huda", decidedAt: new Date("2026-10-21T10:00:00+04:00") },
    ]);
  });

  it("other Teachers are refused: another Class's Class Teacher and the Student's Subject Teacher", async () => {
    const s = await leaveSchool();
    const { id } = await submitLeaveRequest(s.asAisha, { ...fever, attachment: pdf });
    const asBilal = s.app.as({ role: "student", userId: s.bilal });

    for (const actor of [s.asOmar, s.asSara, asBilal, s.asAisha]) {
      await expect(decideLeaveRequest(actor, { leaveRequestId: id, decision: "approved" })).rejects.toThrow(
        AccessDenied,
      );
    }
    await expect(getLeaveAttachment(s.asOmar, { leaveRequestId: id })).rejects.toThrow(AccessDenied);
    await expect(getLeaveAttachment(s.asSara, { leaveRequestId: id })).rejects.toThrow(AccessDenied);
    expect(await getLeaveAttachment(s.asHuda, { leaveRequestId: id })).toMatchObject({ fileName: "doctor.pdf" });
    expect(await myLeaveRequests(s.asAisha)).toMatchObject([{ status: "pending" }]);
  });

  it("after the Student moves Class, the new Class Teacher decides it and the former one is refused", async () => {
    const s = await leaveSchool();
    const { id } = await submitLeaveRequest(s.asAisha, fever);
    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-10-15" });

    await expect(decideLeaveRequest(s.asHuda, { leaveRequestId: id, decision: "approved" })).rejects.toThrow(
      AccessDenied,
    );
    await decideLeaveRequest(s.asOmar, { leaveRequestId: id, decision: "rejected" });
    expect(await myLeaveRequests(s.asAisha)).toMatchObject([{ status: "rejected", decidedBy: "Omar" }]);
  });

  it("a Student in no Class today has no Class Teacher to decide it, only the Admin", async () => {
    const s = await leaveSchool();
    const asBilal = s.app.as({ role: "student", userId: s.bilal });
    s.app.clock.set("2026-08-28T09:00:00+04:00"); // before Bilal's Enrollment in 7-A begins
    const { id } = await submitLeaveRequest(asBilal, fever);

    await expect(decideLeaveRequest(s.asHuda, { leaveRequestId: id, decision: "approved" })).rejects.toThrow(
      AccessDenied,
    );
    await decideLeaveRequest(s.asAdmin, { leaveRequestId: id, decision: "approved" });
    expect(await myLeaveRequests(asBilal)).toMatchObject([{ status: "approved", decidedBy: "Amina Office" }]);
  });
});

describe("The Admin overrides a Class Teacher's decision", () => {
  it("the Admin overrides an approval with a rejection, and a rejection with an approval", async () => {
    const s = await leaveSchool();
    const approved = await submitLeaveRequest(s.asAisha, fever);
    const rejected = await submitLeaveRequest(s.asAisha, { ...fever, reason: "Trip" });
    await decideLeaveRequest(s.asHuda, { leaveRequestId: approved.id, decision: "approved" });
    await decideLeaveRequest(s.asHuda, { leaveRequestId: rejected.id, decision: "rejected" });

    await decideLeaveRequest(s.asAdmin, { leaveRequestId: approved.id, decision: "rejected" });
    await decideLeaveRequest(s.asAdmin, { leaveRequestId: rejected.id, decision: "approved" });

    expect((await myLeaveRequests(s.asAisha)).map((r) => [r.reason, r.status, r.decidedBy])).toEqual([
      ["Trip", "approved", "Amina Office"],
      ["Fever", "rejected", "Amina Office"],
    ]);
  });

  it("the Class Teacher can change their own decision, but not one the Admin made", async () => {
    const s = await leaveSchool();
    const { id } = await submitLeaveRequest(s.asAisha, fever);
    await decideLeaveRequest(s.asHuda, { leaveRequestId: id, decision: "rejected" });
    await decideLeaveRequest(s.asHuda, { leaveRequestId: id, decision: "approved" });
    expect(await myLeaveRequests(s.asAisha)).toMatchObject([{ status: "approved", decidedBy: "Huda" }]);

    await decideLeaveRequest(s.asAdmin, { leaveRequestId: id, decision: "rejected" });

    await expect(decideLeaveRequest(s.asHuda, { leaveRequestId: id, decision: "approved" })).rejects.toThrow(
      LeaveDecidedByAdmin,
    );
    expect(await myLeaveRequests(s.asAisha)).toMatchObject([{ status: "rejected", decidedBy: "Amina Office" }]);
    // She can still see it and its attachment, though.
    expect(await getLeaveAttachment(s.asHuda, { leaveRequestId: id })).toBeNull();
  });
});

describe("Approved leave excuses Absent Marks", () => {
  it("approving turns the Student's Absent Marks on Assessments in the leave dates into Exempt, and nothing else", async () => {
    const s = await leaveSchool();
    await quizOn(s, "2026-10-04", { [s.aisha]: "absent" });
    await quizOn(s, "2026-10-05", { [s.aisha]: "absent", [s.bilal]: "absent" });
    await quizOn(s, "2026-10-06", { [s.aisha]: 7 });
    await quizOn(s, "2026-10-07", { [s.aisha]: "absent" }); // the last day counts
    await quizOn(s, "2026-10-07", { [s.bilal]: 5 }); // Aisha has no Mark on this one
    await quizOn(s, "2026-10-08", { [s.aisha]: "absent" });
    const { id } = await submitLeaveRequest(s.asAisha, fever); // 2026-10-05 to 2026-10-07

    const outcome = await decideLeaveRequest(s.asHuda, { leaveRequestId: id, decision: "approved" });

    expect(outcome).toEqual({ marksExempted: 2, marksRestored: 0, marksFrozen: 0 });
    const history = await studentAssessmentHistory(s.asAdmin, { studentId: s.aisha });
    expect(history.map((r) => [r.date, r.mark])).toEqual([
      ["2026-10-08", "absent"],
      ["2026-10-07", null],
      ["2026-10-07", "exempt"],
      ["2026-10-06", 7],
      ["2026-10-05", "exempt"],
      ["2026-10-04", "absent"],
    ]);
    const bilals = await studentAssessmentHistory(s.asAdmin, { studentId: s.bilal });
    expect(bilals.find((r) => r.date === "2026-10-05")?.mark).toBe("absent");
  });

  it("a pending or rejected request changes no Marks", async () => {
    const s = await leaveSchool();
    await quizOn(s, "2026-10-06", { [s.aisha]: "absent" });
    const { id } = await submitLeaveRequest(s.asAisha, fever);
    expect(await aishasMarks(s)).toEqual({ "2026-10-06": "absent" });

    const outcome = await decideLeaveRequest(s.asHuda, { leaveRequestId: id, decision: "rejected" });

    expect(outcome).toEqual({ marksExempted: 0, marksRestored: 0, marksFrozen: 0 });
    expect(await aishasMarks(s)).toEqual({ "2026-10-06": "absent" });
  });
});

describe("Overriding an approval with a rejection", () => {
  it("puts back to Absent exactly the Marks the approval made Exempt, and re-approving excuses them again", async () => {
    const s = await leaveSchool();
    await quizOn(s, "2026-10-05", { [s.aisha]: "absent" });
    await quizOn(s, "2026-10-06", { [s.aisha]: "exempt" }); // Exempt already, not the leave's doing
    const { id } = await submitLeaveRequest(s.asAisha, fever);
    await decideLeaveRequest(s.asHuda, { leaveRequestId: id, decision: "approved" });
    // Entered after the approval: Absent, though inside the leave dates.
    await quizOn(s, "2026-10-07", { [s.aisha]: "absent" });

    const rejected = await decideLeaveRequest(s.asAdmin, { leaveRequestId: id, decision: "rejected" });

    expect(rejected).toEqual({ marksExempted: 0, marksRestored: 1, marksFrozen: 0 });
    expect(await aishasMarks(s)).toEqual({ "2026-10-05": "absent", "2026-10-06": "exempt", "2026-10-07": "absent" });

    const approved = await decideLeaveRequest(s.asAdmin, { leaveRequestId: id, decision: "approved" });

    expect(approved).toEqual({ marksExempted: 2, marksRestored: 0, marksFrozen: 0 });
    expect(await aishasMarks(s)).toEqual({ "2026-10-05": "exempt", "2026-10-06": "exempt", "2026-10-07": "exempt" });
  });

  it("leaves alone a Mark someone has since edited, even back to Exempt", async () => {
    const s = await leaveSchool();
    const scored = await quizOn(s, "2026-10-05", { [s.aisha]: "absent" });
    const reExempted = await quizOn(s, "2026-10-06", { [s.aisha]: "absent" });
    const cleared = await quizOn(s, "2026-10-07", { [s.aisha]: "absent" });
    const { id } = await submitLeaveRequest(s.asAisha, fever);
    await decideLeaveRequest(s.asHuda, { leaveRequestId: id, decision: "approved" });
    const save = (assessmentId: number, mark: MarkValue) =>
      saveMarks(s.asSara, { assessmentId, marks: [{ studentId: s.aisha, mark }] });
    await save(scored, 6); // she sat it after all
    await save(reExempted, "absent");
    await save(reExempted, "exempt"); // the Subject Teacher's own Exempt now
    await save(cleared, null);
    await save(cleared, "exempt");

    const outcome = await decideLeaveRequest(s.asAdmin, { leaveRequestId: id, decision: "rejected" });

    expect(outcome).toEqual({ marksExempted: 0, marksRestored: 0, marksFrozen: 0 });
    expect(await aishasMarks(s)).toEqual({ "2026-10-05": 6, "2026-10-06": "exempt", "2026-10-07": "exempt" });
  });

  it("re-saving a grid without changing the Mark keeps it the leave's", async () => {
    const s = await leaveSchool();
    const quizId = await quizOn(s, "2026-10-05", { [s.aisha]: "absent", [s.bilal]: 4 });
    const { id } = await submitLeaveRequest(s.asAisha, fever);
    await decideLeaveRequest(s.asHuda, { leaveRequestId: id, decision: "approved" });
    await saveMarks(s.asSara, {
      assessmentId: quizId,
      marks: [
        { studentId: s.aisha, mark: "exempt" },
        { studentId: s.bilal, mark: 5 },
      ],
    });

    await decideLeaveRequest(s.asAdmin, { leaveRequestId: id, decision: "rejected" });

    expect(await aishasMarks(s)).toEqual({ "2026-10-05": "absent" });
  });

  it("a Mark another approved Leave Request also covers stays Exempt until that one is rejected too", async () => {
    const s = await leaveSchool();
    await quizOn(s, "2026-10-05", { [s.aisha]: "absent" });
    await quizOn(s, "2026-10-07", { [s.aisha]: "absent" });
    const first = await submitLeaveRequest(s.asAisha, fever); // 10-05 to 10-07
    const second = await submitLeaveRequest(s.asAisha, { startDate: "2026-10-07", endDate: "2026-10-09", reason: "Still ill" });
    await decideLeaveRequest(s.asHuda, { leaveRequestId: first.id, decision: "approved" });
    await decideLeaveRequest(s.asHuda, { leaveRequestId: second.id, decision: "approved" });

    expect(await decideLeaveRequest(s.asAdmin, { leaveRequestId: first.id, decision: "rejected" })).toEqual({
      marksExempted: 0,
      marksRestored: 1,
      marksFrozen: 0,
    });
    expect(await aishasMarks(s)).toEqual({ "2026-10-05": "absent", "2026-10-07": "exempt" });

    await decideLeaveRequest(s.asAdmin, { leaveRequestId: second.id, decision: "rejected" });
    expect(await aishasMarks(s)).toEqual({ "2026-10-05": "absent", "2026-10-07": "absent" });
  });
});

describe("Frozen Marks", () => {
  it("Marks a Published Report Card freezes are skipped and counted, and the decision still stands", async () => {
    const s = await leaveSchool();
    await quizOn(s, "2026-12-30", { [s.aisha]: "absent" }); // Term 1
    await quizOn(s, "2027-01-02", { [s.aisha]: "absent" }); // Term 2
    const { terms } = await classReportCards(s.asAdmin, { classId: s.class7A.id });
    const term1 = { classId: s.class7A.id, termId: terms[0].id };
    await publishReportCards(s.asAdmin, term1);
    const { id } = await submitLeaveRequest(s.asAisha, {
      startDate: "2026-12-30",
      endDate: "2027-01-02",
      reason: "Family trip",
    });
    const decide = (decision: "approved" | "rejected") =>
      decideLeaveRequest(s.asAdmin, { leaveRequestId: id, decision });

    expect(await decideLeaveRequest(s.asHuda, { leaveRequestId: id, decision: "approved" })).toEqual({
      marksExempted: 1,
      marksRestored: 0,
      marksFrozen: 1,
    });
    expect(await myLeaveRequests(s.asAisha)).toMatchObject([{ status: "approved" }]);
    expect(await aishasMarks(s)).toEqual({ "2026-12-30": "absent", "2027-01-02": "exempt" });

    // Unpublished, approving again reaches the Term 1 Mark.
    await unpublishReportCards(s.asAdmin, term1);
    expect(await decide("approved")).toEqual({ marksExempted: 1, marksRestored: 0, marksFrozen: 0 });
    expect(await aishasMarks(s)).toEqual({ "2026-12-30": "exempt", "2027-01-02": "exempt" });

    // Published again, a rejection can't put the Term 1 Mark back, but the rejection stands.
    await publishReportCards(s.asAdmin, term1);
    expect(await decide("rejected")).toEqual({ marksExempted: 0, marksRestored: 1, marksFrozen: 1 });
    expect(await myLeaveRequests(s.asAisha)).toMatchObject([{ status: "rejected" }]);
    expect(await aishasMarks(s)).toEqual({ "2026-12-30": "exempt", "2027-01-02": "absent" });

    // Once unpublished, rejecting again puts it back.
    await unpublishReportCards(s.asAdmin, term1);
    expect(await decide("rejected")).toEqual({ marksExempted: 0, marksRestored: 1, marksFrozen: 0 });
    expect(await aishasMarks(s)).toEqual({ "2026-12-30": "absent", "2027-01-02": "absent" });
  });
});

describe("Who sees which Student Leave Requests", () => {
  it("the Class Teacher lists their Class's Students' requests: pending oldest first, then decided", async () => {
    const s = await leaveSchool();
    const asBilal = s.app.as({ role: "student", userId: s.bilal });
    const at = (time: string) => s.app.clock.set(`2026-10-${time}+04:00`);
    at("20T09:00:00");
    const aishas = await submitLeaveRequest(s.asAisha, fever);
    at("20T10:00:00");
    const bilals = await submitLeaveRequest(asBilal, { ...fever, reason: "Dentist" });
    at("20T11:00:00");
    const aishasSecond = await submitLeaveRequest(s.asAisha, { ...fever, reason: "Wedding" });
    await submitLeaveRequest(s.asHuda, fever); // her own request isn't her Class's
    at("21T09:00:00");
    await decideLeaveRequest(s.asHuda, { leaveRequestId: bilals.id, decision: "approved" });
    at("21T10:00:00");
    await decideLeaveRequest(s.asAdmin, { leaveRequestId: aishasSecond.id, decision: "rejected" });

    const list = await classLeaveRequests(s.asHuda);

    expect(list.pending.map((r) => [r.id, r.requester, r.class, r.canDecide])).toEqual([
      [aishas.id, "Aisha Rahman", "7-A", true],
    ]);
    expect(list.decided.map((r) => [r.id, r.requester, r.status, r.canDecide])).toEqual([
      [aishasSecond.id, "Aisha Rahman", "rejected", false], // the Admin decided it
      [bilals.id, "Bilal Khan", "approved", true],
    ]);
    expect(await classLeaveRequests(s.asOmar)).toEqual({ pending: [], decided: [] });
    expect(await classLeaveRequests(s.asSara)).toEqual({ pending: [], decided: [] });
  });

  it("a Student who moves Class takes their requests to the new Class Teacher's list", async () => {
    const s = await leaveSchool();
    await submitLeaveRequest(s.asAisha, fever);
    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-10-15" });

    expect((await classLeaveRequests(s.asHuda)).pending).toEqual([]);
    expect((await classLeaveRequests(s.asOmar)).pending.map((r) => [r.requester, r.class])).toEqual([
      ["Aisha Rahman", "7-B"],
    ]);
  });

  it("the Admin lists Student requests apart from Teacher requests", async () => {
    const s = await leaveSchool();
    const aishas = await submitLeaveRequest(s.asAisha, fever);
    const hudas = await submitLeaveRequest(s.asHuda, fever);

    expect((await studentLeaveRequests(s.asAdmin)).pending.map((r) => r.id)).toEqual([aishas.id]);
    expect((await teacherLeaveRequests(s.asAdmin)).pending.map((r) => r.id)).toEqual([hudas.id]);
  });

  it("only Teachers have a Class list and only the Admin has the school's list", async () => {
    const s = await leaveSchool();

    await expect(classLeaveRequests(s.asAdmin)).rejects.toThrow(AccessDenied);
    await expect(classLeaveRequests(s.asAisha)).rejects.toThrow(AccessDenied);
    await expect(studentLeaveRequests(s.asHuda)).rejects.toThrow(AccessDenied);
    await expect(studentLeaveRequests(s.asAisha)).rejects.toThrow(AccessDenied);
  });
});

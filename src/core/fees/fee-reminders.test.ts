import { describe, expect, it } from "vitest";
import { registerStudent } from "../students/register-student";
import type { Email } from "../mailer";
import { AccessDenied, InvalidInput, NotFound } from "../errors";
import { applyFeeToStudents, getFee, waiveFeeAssignment } from "./fee-assignments";
import {
  getFeeReminderSettings,
  noEmailReport,
  sendDailyFeeReminders,
  sendFeeRemindersNow,
  setFeeReminderSettings,
} from "./fee-reminders";
import { logPaymentRecord } from "./payment-records";
import { feesSchool } from "./test-fees";

// `feesSchool()` (today 2026-10-01) plus two Students with an email on record. Aisha,
// Bilal, Chen and Dana have none.
async function remindersSchool() {
  const s = await feesSchool();
  const withEmail = async (name: string, studentNumber: string, email: string) =>
    (
      await registerStudent(s.asAdmin, {
        name,
        studentNumber,
        email,
        dateOfBirth: "2012-01-01",
        nationalId: `784-${studentNumber}`,
        guardianContact: `Guardian of ${name}, +971 50 111 1111`,
        admissionDate: "2026-08-25",
      })
    ).studentId;
  const eman = await withEmail("Eman Haddad", "S-5", "eman.family@mail.test");
  const farid = await withEmail("Farid Nasser", "S-6", "farid.family@mail.test");
  const on = (date: string) => s.app.clock.set(`${date}T06:00:00+04:00`);
  const daily = () => sendDailyFeeReminders(s.app.deps);
  /** The school dates in [from, to] on which the daily job sent anything, with whom to. */
  const runDaily = async (from: string, to: string) => {
    const sentOn: [string, string[]][] = [];
    for (let day = from; day <= to; day = nextDate(day)) {
      on(day);
      const before = s.app.mailer.sent.length;
      await daily();
      const recipients = s.app.mailer.sent.slice(before).map((m) => m.to);
      if (recipients.length) sentOn.push([day, recipients]);
    }
    return sentOn;
  };
  const owe = async (studentIds: string[], over: Parameters<typeof s.newFee>[0] = {}) => {
    const fee = await s.newFee(over);
    await applyFeeToStudents(s.asAdmin, { feeId: fee.id, studentIds });
    const { assignments } = await getFee(s.asAdmin, { feeId: fee.id });
    return { fee, assignments };
  };
  return { ...s, eman, farid, on, daily, runDaily, owe };
}

function nextDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

describe("Fee Reminders: the daily job", () => {
  it("emails one upcoming reminder 7 days before the due date, with the Fee's name, amount, due date and status", async () => {
    const s = await remindersSchool();
    await s.owe([s.eman], { name: "Term 1 Tuition", amount: "12,500.50", dueDate: "2026-10-15" });

    expect(await s.runDaily("2026-10-01", "2026-10-15")).toEqual([["2026-10-08", ["eman.family@mail.test"]]]);

    const [email] = s.app.mailer.sent;
    expect(email.subject).toContain("Term 1 Tuition");
    for (const part of ["Eman Haddad", "Term 1 Tuition", "AED 12,500.50", "2026-10-15", "Unpaid"]) {
      expect(email.text).toContain(part);
    }
  });

  it("emails an Overdue reminder on the first Overdue day and then every 7 days while it stays Overdue", async () => {
    const s = await remindersSchool();
    await s.owe([s.eman], { name: "Bus", amount: "300", dueDate: "2026-10-15" });

    expect(await s.runDaily("2026-10-01", "2026-11-05")).toEqual([
      ["2026-10-08", ["eman.family@mail.test"]],
      ["2026-10-16", ["eman.family@mail.test"]],
      ["2026-10-23", ["eman.family@mail.test"]],
      ["2026-10-30", ["eman.family@mail.test"]],
    ]);
    const overdue = s.app.mailer.sent[1];
    expect(overdue.subject).toContain("Overdue");
    expect(overdue.text).toContain("Unpaid, Overdue");
  });

  it("running twice on one day, or missing days and catching up, never sends twice", async () => {
    const s = await remindersSchool();
    await s.owe([s.eman], { dueDate: "2026-10-15" });

    s.on("2026-10-12"); // the job didn't run from the 8th to the 11th
    expect(await s.daily()).toEqual({ sent: 1, noEmail: 0, alreadySentToday: 0, failed: 0 });
    expect(await s.daily()).toEqual({ sent: 0, noEmail: 0, alreadySentToday: 0, failed: 0 });
    s.on("2026-10-20"); // nor from the 13th to the 19th: one Overdue reminder, not one per missed week
    expect(await s.daily()).toEqual({ sent: 1, noEmail: 0, alreadySentToday: 0, failed: 0 });
    expect(await s.daily()).toEqual({ sent: 0, noEmail: 0, alreadySentToday: 0, failed: 0 });
    expect(await s.runDaily("2026-10-21", "2026-10-31")).toEqual([["2026-10-27", ["eman.family@mail.test"]]]);
  });

  it("a job that first runs after the due date sends only the Overdue reminder", async () => {
    const s = await remindersSchool();
    await s.owe([s.eman], { dueDate: "2026-10-15" });

    s.on("2026-10-18");
    await s.daily();

    expect(s.app.mailer.sent.map((m) => m.subject)).toEqual([expect.stringContaining("Overdue")]);
  });

  it("Paid and Waived Fee Assignments never get a reminder, and a Partially Paid one does", async () => {
    const s = await remindersSchool();
    const { assignments } = await s.owe([s.eman, s.farid], { name: "Tuition", amount: "1,000", dueDate: "2026-10-15" });
    const [emanTuition, faridTuition] = assignments;
    const pay = (feeAssignmentId: number, amount: string) =>
      logPaymentRecord(s.asAdmin, { feeAssignmentId, amount, date: "2026-10-01", method: "cash", reference: "" });
    await pay(emanTuition.id, "400");
    await waiveFeeAssignment(s.asAdmin, { feeAssignmentId: faridTuition.id });

    expect(await s.runDaily("2026-10-01", "2026-10-16")).toEqual([
      ["2026-10-08", ["eman.family@mail.test"]],
      ["2026-10-16", ["eman.family@mail.test"]],
    ]);
    expect(s.app.mailer.sent[0].text).toContain("Partially Paid");
    expect(s.app.mailer.sent[0].text).toContain("Still to pay: AED\u00a0600.00");

    await pay(emanTuition.id, "600");
    expect(await s.runDaily("2026-10-17", "2026-11-30")).toEqual([]);
  });

  it("a Student with no email is skipped and counted, never an error", async () => {
    const s = await remindersSchool();
    await s.owe([s.aisha, s.dana, s.eman], { dueDate: "2026-10-15" });

    s.on("2026-10-08");
    expect(await s.daily()).toEqual({ sent: 1, noEmail: 2, alreadySentToday: 0, failed: 0 });
    expect(s.app.mailer.sent.map((m) => m.to)).toEqual(["eman.family@mail.test"]);
  });

  it("follows the school-wide timings the Admin sets", async () => {
    const s = await remindersSchool();
    expect(await getFeeReminderSettings(s.asAdmin)).toEqual({ leadDays: 7, intervalDays: 7 });
    await setFeeReminderSettings(s.asAdmin, { leadDays: 3, intervalDays: 2 });
    expect(await getFeeReminderSettings(s.asAdmin)).toEqual({ leadDays: 3, intervalDays: 2 });
    await s.owe([s.eman], { dueDate: "2026-10-15" });

    expect((await s.runDaily("2026-10-01", "2026-10-20")).map(([day]) => day)).toEqual([
      "2026-10-12",
      "2026-10-16",
      "2026-10-18",
      "2026-10-20",
    ]);
  });

  it("each timing must be a whole number of days from 1 to 365", async () => {
    const s = await remindersSchool();
    for (const bad of [0, -1, 1.5, Number.NaN, 366]) {
      await expect(setFeeReminderSettings(s.asAdmin, { leadDays: bad, intervalDays: 7 })).rejects.toThrow(
        new InvalidInput("errors.feeReminderDaysInvalid"),
      );
      await expect(setFeeReminderSettings(s.asAdmin, { leadDays: 7, intervalDays: bad })).rejects.toThrow(
        new InvalidInput("errors.feeReminderDaysInvalid"),
      );
    }
    await setFeeReminderSettings(s.asAdmin, { leadDays: 1, intervalDays: 365 });
    expect(await getFeeReminderSettings(s.asAdmin)).toEqual({ leadDays: 1, intervalDays: 365 });
  });
});

describe("Fee Reminders: Send reminders now", () => {
  it("emails every outstanding Fee Assignment of that Fee at once, whatever the timing, skipping Paid, Waived and no-email", async () => {
    const s = await remindersSchool();
    const other = await s.owe([s.eman], { name: "Bus", dueDate: "2026-10-03" });
    const { fee, assignments } = await s.owe([s.eman, s.farid, s.aisha, s.dana], { name: "Trip", dueDate: "2026-12-01" });
    const of = (studentId: string) => assignments.find((a) => a.studentId === studentId)!.id;
    await logPaymentRecord(s.asAdmin, { feeAssignmentId: of(s.farid), amount: "1,000", date: "2026-10-01", method: "cash", reference: "" });
    await waiveFeeAssignment(s.asAdmin, { feeAssignmentId: of(s.dana) });

    expect(await sendFeeRemindersNow(s.asAdmin, { feeId: fee.id })).toEqual({
      sent: 1,
      noEmail: 1,
      alreadySentToday: 0,
      failed: 0,
    });
    expect(s.app.mailer.sent.map((m) => [m.to, m.subject])).toEqual([
      ["eman.family@mail.test", expect.stringContaining("Trip")],
    ]);
    expect(other.assignments).toHaveLength(1);
  });

  it("goes in the log: a second press the same day sends nothing, and a press while Overdue restarts the interval", async () => {
    const s = await remindersSchool();
    const { fee } = await s.owe([s.eman], { dueDate: "2026-10-15" });
    const now = () => sendFeeRemindersNow(s.asAdmin, { feeId: fee.id });

    expect(await now()).toEqual({ sent: 1, noEmail: 0, alreadySentToday: 0, failed: 0 });
    expect(await now()).toEqual({ sent: 0, noEmail: 0, alreadySentToday: 1, failed: 0 });
    // Pressed before the upcoming window, so the job still sends its own a week ahead.
    expect(await s.runDaily("2026-10-02", "2026-10-19")).toEqual([
      ["2026-10-08", ["eman.family@mail.test"]],
      ["2026-10-16", ["eman.family@mail.test"]],
    ]);
    s.on("2026-10-20");
    await now();
    expect(await s.daily()).toEqual({ sent: 0, noEmail: 0, alreadySentToday: 0, failed: 0 });
    // Without the press the next would be on the 23rd.
    expect(await s.runDaily("2026-10-21", "2026-10-28")).toEqual([["2026-10-27", ["eman.family@mail.test"]]]);
  });

  it("a press inside the upcoming window counts as the upcoming reminder", async () => {
    const s = await remindersSchool();
    const { fee } = await s.owe([s.eman], { dueDate: "2026-10-15" });

    s.on("2026-10-10");
    await sendFeeRemindersNow(s.asAdmin, { feeId: fee.id });

    expect(await s.runDaily("2026-10-10", "2026-10-16")).toEqual([["2026-10-16", ["eman.family@mail.test"]]]);
  });

  it("an email that fails to send isn't logged, so the next run tries again, and the others still go", async () => {
    const s = await remindersSchool();
    await s.owe([s.eman, s.farid], { dueDate: "2026-10-15" });
    let down = true;
    const flaky = {
      async send(email: Email) {
        if (down && email.to === "eman.family@mail.test") throw new Error("SMTP refused");
        await s.app.mailer.send(email);
      },
    };
    const daily = () => sendDailyFeeReminders({ ...s.app.deps, mailer: flaky });

    s.on("2026-10-08");
    expect(await daily()).toEqual({ sent: 1, noEmail: 0, alreadySentToday: 0, failed: 1 });
    down = false;
    s.on("2026-10-09");
    expect(await daily()).toEqual({ sent: 1, noEmail: 0, alreadySentToday: 0, failed: 0 });
    expect(s.app.mailer.sent.map((m) => m.to)).toEqual(["farid.family@mail.test", "eman.family@mail.test"]);
  });

  it("only the Admin sets the timings, sends reminders now and sees the no-email report", async () => {
    const s = await remindersSchool();
    const { fee } = await s.owe([s.aisha], { dueDate: "2026-10-15" });
    // Huda is Aisha's Class Teacher.
    for (const ctx of [s.app.as(s.huda), s.asStudent(s.aisha)]) {
      await expect(getFeeReminderSettings(ctx)).rejects.toThrow(AccessDenied);
      await expect(setFeeReminderSettings(ctx, { leadDays: 3, intervalDays: 3 })).rejects.toThrow(AccessDenied);
      await expect(sendFeeRemindersNow(ctx, { feeId: fee.id })).rejects.toThrow(AccessDenied);
      await expect(noEmailReport(ctx)).rejects.toThrow(AccessDenied);
    }
    expect(await getFeeReminderSettings(s.asAdmin)).toEqual({ leadDays: 7, intervalDays: 7 });
  });

  it("an unknown Fee is NotFound", async () => {
    const s = await remindersSchool();
    await expect(sendFeeRemindersNow(s.asAdmin, { feeId: 9999 })).rejects.toThrow(NotFound);
  });
});

describe("The no-email report", () => {
  it("lists every Student with no email, by name, and whether each has an outstanding Fee", async () => {
    const s = await remindersSchool();
    const { assignments } = await s.owe([s.aisha, s.bilal, s.chen, s.eman], { amount: "1,000" });
    const of = (studentId: string) => assignments.find((a) => a.studentId === studentId)!.id;
    const pay = (studentId: string, amount: string) =>
      logPaymentRecord(s.asAdmin, { feeAssignmentId: of(studentId), amount, date: "2026-10-01", method: "cash", reference: "" });
    await pay(s.aisha, "400"); // Partially Paid: outstanding
    await pay(s.bilal, "1,000"); // Paid
    await waiveFeeAssignment(s.asAdmin, { feeAssignmentId: of(s.chen) }); // Waived
    // Dana owes nothing; Eman has an email.

    const report = await noEmailReport(s.asAdmin);

    expect(report.map((r) => [r.name, r.studentNumber, r.hasOutstandingFee])).toEqual([
      ["Aisha Rahman", "S-1", true],
      ["Bilal Khan", "S-2", false],
      ["Chen Li", "S-3", false],
      ["Dana Saleh", "S-4", false],
    ]);
    expect(report[0].guardianContact).toBe("Guardian, +971 50 000 0000");
  });

  it("the Students the daily job skips for having no email are the ones the report lists", async () => {
    const s = await remindersSchool();
    await s.owe([s.dana, s.eman], { dueDate: "2026-10-05" });

    s.on("2026-10-06");
    expect(await s.daily()).toEqual({ sent: 1, noEmail: 1, alreadySentToday: 0, failed: 0 });
    expect((await noEmailReport(s.asAdmin)).filter((r) => r.hasOutstandingFee).map((r) => r.name)).toEqual(["Dana Saleh"]);
  });
});

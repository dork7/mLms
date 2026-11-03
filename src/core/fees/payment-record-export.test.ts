import { describe, expect, it } from "vitest";
import { AccessDenied, NotFound } from "../errors";
import { applyFeeToStudents, getFee, waiveFeeAssignment } from "./fee-assignments";
import { logPaymentRecord } from "./payment-records";
import { paymentRecordExport } from "./payment-record-export";
import { feesSchool } from "./test-fees";

/** Aisha owes AED 1,000 Term 1 Tuition and has paid AED 400 by bank transfer and AED 100 in cash. */
async function aishaHasPaid() {
  const s = await feesSchool();
  const { id: feeId } = await s.newFee({ name: "Term 1 Tuition", amount: "1,000", dueDate: "2026-10-15" });
  await applyFeeToStudents(s.asAdmin, { feeId, studentIds: [s.aisha, s.bilal] });
  const assignments = (await getFee(s.asAdmin, { feeId })).assignments;
  const aishaTuition = assignments.find((a) => a.studentId === s.aisha)!;
  const bilalTuition = assignments.find((a) => a.studentId === s.bilal)!;
  const pay = (feeAssignmentId: number, amount: string, date: string, method: string, reference: string) =>
    logPaymentRecord(s.asAdmin, { feeAssignmentId, amount, date, method, reference });
  const transfer = await pay(aishaTuition.id, "400", "2026-09-28", "bank_transfer", "TRX-77");
  const cash = await pay(aishaTuition.id, "100", "2026-09-30", "cash", "");
  const bilals = await pay(bilalTuition.id, "1,000", "2026-09-29", "cheque", "CHQ-5");
  return { ...s, aishaTuition, transfer, cash, bilals };
}

describe("Payment Record PDF", () => {
  it("a Student gets their own Payment Record with its Fee, and the Fee Assignment's Fee Status and amount paid to date", async () => {
    const s = await aishaHasPaid();

    const exported = await paymentRecordExport(s.asStudent(s.aisha), { paymentRecordId: s.transfer.id });

    expect(exported).toEqual({
      fileName: `payment-record-S-1-${s.transfer.id}.pdf`,
      school: expect.any(String),
      asOf: "2026-10-01",
      student: { name: "Aisha Rahman", studentNumber: "S-1" },
      fee: { id: expect.any(Number), name: "Term 1 Tuition", amountFils: 100_000, dueDate: "2026-10-15" },
      payment: { id: s.transfer.id, amountFils: 40_000, paidOn: "2026-09-28", method: "bank_transfer", reference: "TRX-77" },
      status: "partiallyPaid",
      paidFils: 50_000,
    });
  });

  it("a Student is refused another Student's Payment Record", async () => {
    const s = await aishaHasPaid();

    await expect(paymentRecordExport(s.asStudent(s.aisha), { paymentRecordId: s.bilals.id })).rejects.toThrow(AccessDenied);
    await expect(paymentRecordExport(s.asStudent(s.bilal), { paymentRecordId: s.cash.id })).rejects.toThrow(AccessDenied);
  });

  it("the Admin gets any Student's Payment Record", async () => {
    const s = await aishaHasPaid();

    const bilals = await paymentRecordExport(s.asAdmin, { paymentRecordId: s.bilals.id });
    const aishas = await paymentRecordExport(s.asAdmin, { paymentRecordId: s.cash.id });

    expect(bilals).toMatchObject({
      student: { name: "Bilal Khan", studentNumber: "S-2" },
      payment: { amountFils: 100_000, paidOn: "2026-09-29", method: "cheque", reference: "CHQ-5" },
      status: "paid",
      paidFils: 100_000,
    });
    expect(aishas).toEqual(await paymentRecordExport(s.asStudent(s.aisha), { paymentRecordId: s.cash.id }));
  });

  it("Teachers, including the Student's Class Teacher, are refused every Payment Record", async () => {
    const s = await aishaHasPaid(); // Huda is Aisha's Class Teacher (7-A); Omar is Bilal's (7-B)

    for (const teacher of [s.huda, s.omar, s.sara]) {
      for (const paymentRecordId of [s.transfer.id, s.bilals.id, 999_999]) {
        await expect(paymentRecordExport(s.app.as(teacher), { paymentRecordId })).rejects.toThrow(AccessDenied);
      }
    }
  });

  it("an unknown Payment Record is not found", async () => {
    const s = await aishaHasPaid();

    await expect(paymentRecordExport(s.asAdmin, { paymentRecordId: 999_999 })).rejects.toThrow(NotFound);
    await expect(paymentRecordExport(s.asStudent(s.aisha), { paymentRecordId: Number("x") })).rejects.toThrow(NotFound);
  });

  it("a Payment Record of a waived Fee Assignment reads Waived, with what was paid before the waiver", async () => {
    const s = await aishaHasPaid();
    await waiveFeeAssignment(s.asAdmin, { feeAssignmentId: s.aishaTuition.id });

    const exported = await paymentRecordExport(s.asStudent(s.aisha), { paymentRecordId: s.cash.id });

    expect(exported).toMatchObject({ status: "waived", paidFils: 50_000, payment: { amountFils: 10_000, reference: "" } });
  });

  it("names the school set for this deployment, or the app's name without one", async () => {
    const s = await aishaHasPaid();
    const before = process.env.SCHOOL_NAME;
    try {
      delete process.env.SCHOOL_NAME;
      expect((await paymentRecordExport(s.asAdmin, { paymentRecordId: s.cash.id })).school).toBe("School LMS");
      process.env.SCHOOL_NAME = "Al Noor Academy";
      expect((await paymentRecordExport(s.asAdmin, { paymentRecordId: s.cash.id })).school).toBe("Al Noor Academy");
    } finally {
      if (before === undefined) delete process.env.SCHOOL_NAME;
      else process.env.SCHOOL_NAME = before;
    }
  });
});

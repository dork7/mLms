import { describe, expect, it } from "vitest";
import { AccessDenied, InvalidInput, NotFound } from "../errors";
import {
  applyFeeToStudents,
  getFee,
  getFeeAssignment,
  unwaiveFeeAssignment,
  waiveFeeAssignment,
} from "./fee-assignments";
import { logPaymentRecord } from "./payment-records";
import { feesSchool } from "./test-fees";

async function aishaOwes(amount = "1,000") {
  const s = await feesSchool(); // today 2026-10-01
  const { id: feeId } = await s.newFee({ amount });
  await applyFeeToStudents(s.asAdmin, { feeId, studentIds: [s.aisha] });
  const [assignment] = (await getFee(s.asAdmin, { feeId })).assignments;
  const pay = (amount: string, over: Partial<{ date: string; method: string; reference: string }> = {}) =>
    logPaymentRecord(s.asAdmin, {
      feeAssignmentId: assignment.id,
      amount,
      date: "2026-09-28",
      method: "cash",
      reference: "R-001",
      ...over,
    });
  const status = async () => (await getFee(s.asAdmin, { feeId })).assignments[0];
  return { ...s, feeId, assignmentId: assignment.id, pay, status };
}

describe("Payment Records and Fee Status", () => {
  it("Fee Status goes from Unpaid to Partially Paid to Paid as Payment Records are logged", async () => {
    const s = await aishaOwes("1,000");
    expect(await s.status()).toMatchObject({ status: "unpaid", paidFils: 0 });

    await s.pay("400", { method: "bank_transfer", reference: "TRX-77" });
    expect(await s.status()).toMatchObject({ status: "partiallyPaid", paidFils: 40_000 });

    await s.pay("600.00", { date: "2026-10-01", method: "cheque", reference: "CHQ 12" });
    const paid = await s.status();
    expect(paid).toMatchObject({ status: "paid", paidFils: 100_000 });
    expect(paid.payments).toEqual([
      expect.objectContaining({ amountFils: 40_000, paidOn: "2026-09-28", method: "bank_transfer", reference: "TRX-77" }),
      expect.objectContaining({ amountFils: 60_000, paidOn: "2026-10-01", method: "cheque", reference: "CHQ 12" }),
    ]);
  });

  it("paying more than the amount still reads Paid", async () => {
    const s = await aishaOwes("1,000");
    await s.pay("1,000.01");
    expect(await s.status()).toMatchObject({ status: "paid", paidFils: 100_001 });
  });

  it("a Payment Record needs an amount above zero, a real date not after today, a known method and a short reference", async () => {
    const s = await aishaOwes(); // today 2026-10-01
    const refused = (key: string) => new InvalidInput(key);

    for (const amount of ["0", "-1", "1.001", "ten"]) {
      await expect(s.pay(amount)).rejects.toThrow(refused("errors.paymentAmountInvalid"));
    }
    for (const date of ["2026-10-02", "2026-13-01", ""]) {
      await expect(s.pay("10", { date })).rejects.toThrow(refused("errors.paymentDateInvalid"));
    }
    await expect(s.pay("10", { method: "card" })).rejects.toThrow(refused("errors.paymentMethodInvalid"));
    await expect(s.pay("10", { reference: "x".repeat(201) })).rejects.toThrow(refused("errors.paymentReferenceTooLong"));
    await expect(
      logPaymentRecord(s.asAdmin, { feeAssignmentId: 9999, amount: "10", date: "2026-10-01", method: "cash", reference: "" }),
    ).rejects.toThrow(NotFound);
    expect(await s.status()).toMatchObject({ status: "unpaid", payments: [] });

    await s.pay("10", { reference: "  " });
    expect((await s.status()).payments).toEqual([expect.objectContaining({ amountFils: 1_000, reference: "" })]);
  });

  it("an Admin waives a Fee Assignment, which reads Waived whatever was paid, and can undo it", async () => {
    const s = await aishaOwes("1,000");
    await s.pay("250");

    await waiveFeeAssignment(s.asAdmin, { feeAssignmentId: s.assignmentId });
    expect(await s.status()).toMatchObject({ status: "waived", waived: true, paidFils: 25_000 });

    await unwaiveFeeAssignment(s.asAdmin, { feeAssignmentId: s.assignmentId });
    expect(await s.status()).toMatchObject({ status: "partiallyPaid", waived: false });
  });

  it("a waived Fee Assignment takes no Payment Record", async () => {
    const s = await aishaOwes();
    await waiveFeeAssignment(s.asAdmin, { feeAssignmentId: s.assignmentId });

    await expect(s.pay("10")).rejects.toThrow(new InvalidInput("errors.feeAssignmentWaived"));
    expect((await s.status()).payments).toEqual([]);
    await expect(waiveFeeAssignment(s.asAdmin, { feeAssignmentId: 9999 })).rejects.toThrow(NotFound);
  });

  it("an Admin opens one Fee Assignment with its Student, Fee, Payment Records and Fee Status", async () => {
    const s = await aishaOwes("1,000");
    await s.pay("1,000", { method: "bank_transfer", reference: "TRX-1" });

    expect(await getFeeAssignment(s.asAdmin, { feeAssignmentId: s.assignmentId })).toMatchObject({
      studentName: "Aisha Rahman",
      studentNumber: "S-1",
      fee: { name: "Term 1 Tuition", amountFils: 100_000, dueDate: "2026-10-15" },
      status: "paid",
      payments: [{ amountFils: 100_000, method: "bank_transfer", reference: "TRX-1" }],
    });
    await expect(getFeeAssignment(s.asAdmin, { feeAssignmentId: 9999 })).rejects.toThrow(NotFound);
    await expect(getFeeAssignment(s.app.as(s.huda), { feeAssignmentId: s.assignmentId })).rejects.toThrow(AccessDenied);
  });
});

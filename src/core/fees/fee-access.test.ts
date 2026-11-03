import { describe, expect, it } from "vitest";
import { AccessDenied } from "../errors";
import {
  applyFeeToGrade,
  applyFeeToStudents,
  getFee,
  studentFeeAssignments,
  unwaiveFeeAssignment,
  waiveFeeAssignment,
} from "./fee-assignments";
import { createFee, listFees } from "./fees";
import { logPaymentRecord } from "./payment-records";
import { feesSchool } from "./test-fees";

describe("Who sees Fees", () => {
  it("a Student sees their own Fee Assignments with their Payment Records, soonest due first", async () => {
    const s = await feesSchool();
    const tuition = await s.newFee({ name: "Term 1 Tuition", amount: "1,000", dueDate: "2026-10-15" });
    const bus = await s.newFee({ name: "Bus", amount: "300", dueDate: "2026-09-20" });
    await applyFeeToStudents(s.asAdmin, { feeId: tuition.id, studentIds: [s.aisha, s.bilal] });
    await applyFeeToStudents(s.asAdmin, { feeId: bus.id, studentIds: [s.aisha] });
    const [aishaTuition] = (await getFee(s.asAdmin, { feeId: tuition.id })).assignments;
    await logPaymentRecord(s.asAdmin, {
      feeAssignmentId: aishaTuition.id,
      amount: "500",
      date: "2026-09-30",
      method: "cash",
      reference: "R-9",
    });

    const mine = await studentFeeAssignments(s.asStudent(s.aisha), { studentId: s.aisha });

    expect(mine.map((a) => [a.fee.name, a.fee.amountFils, a.fee.dueDate, a.status])).toEqual([
      ["Bus", 30_000, "2026-09-20", "unpaid"],
      ["Term 1 Tuition", 100_000, "2026-10-15", "partiallyPaid"],
    ]);
    expect(mine[1].payments).toEqual([
      expect.objectContaining({ amountFils: 50_000, paidOn: "2026-09-30", method: "cash", reference: "R-9" }),
    ]);
    expect(await studentFeeAssignments(s.asAdmin, { studentId: s.aisha })).toEqual(mine);
  });

  it("a Student is refused another Student's Fees", async () => {
    const s = await feesSchool();

    await expect(studentFeeAssignments(s.asStudent(s.bilal), { studentId: s.aisha })).rejects.toThrow(AccessDenied);
  });

  it("Teachers, including the Student's Class Teacher, are refused all Fee data, and Students every Admin Fee action", async () => {
    const s = await feesSchool(); // Huda is Aisha's Class Teacher (7-A); Sara teaches her Math
    const { id: feeId } = await s.newFee();
    await applyFeeToStudents(s.asAdmin, { feeId, studentIds: [s.aisha] });
    const [{ id: feeAssignmentId }] = (await getFee(s.asAdmin, { feeId })).assignments;

    for (const ctx of [s.app.as(s.huda), s.app.as(s.sara), s.asStudent(s.aisha)]) {
      const refused: (() => Promise<unknown>)[] = [
        () => createFee(ctx, { name: "Bus", amount: "300", dueDate: "2026-10-01" }),
        () => listFees(ctx),
        () => getFee(ctx, { feeId }),
        () => applyFeeToGrade(ctx, { feeId, gradeId: s.grade7.id }),
        () => applyFeeToStudents(ctx, { feeId, studentIds: [s.aisha] }),
        () => logPaymentRecord(ctx, { feeAssignmentId, amount: "10", date: "2026-10-01", method: "cash", reference: "" }),
        () => waiveFeeAssignment(ctx, { feeAssignmentId }),
        () => unwaiveFeeAssignment(ctx, { feeAssignmentId }),
      ];
      if (ctx.actor.role === "teacher") refused.push(() => studentFeeAssignments(ctx, { studentId: s.aisha }));
      for (const call of refused) await expect(call()).rejects.toThrow(AccessDenied);
    }
    expect((await getFee(s.asAdmin, { feeId })).assignments).toEqual([
      expect.objectContaining({ status: "unpaid", payments: [] }),
    ]);
  });
});

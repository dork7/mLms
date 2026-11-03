import { describe, expect, it } from "vitest";
import { enrollStudent } from "../enrollment/enrollment";
import { AccessDenied, NotFound } from "../errors";
import { promoteClass } from "../year-end/year-end";
import { applyFeeToGrade, applyFeeToStudents, feeApplyChoices, getFee } from "./fee-assignments";
import { feesSchool } from "./test-fees";

const who = (fee: { assignments: { studentName: string; status: string }[] }) =>
  fee.assignments.map((a) => [a.studentName, a.status]);

describe("Fee Assignments", () => {
  it("applying a Fee to a Grade creates an Unpaid Fee Assignment for each Student in that Grade", async () => {
    const s = await feesSchool();
    const { id: feeId } = await s.newFee();

    expect(await applyFeeToGrade(s.asAdmin, { feeId, gradeId: s.grade7.id })).toEqual({ assigned: 2 });

    expect(who(await getFee(s.asAdmin, { feeId }))).toEqual([
      ["Aisha Rahman", "unpaid"],
      ["Bilal Khan", "unpaid"],
    ]);
  });

  it("applying a Fee to specific Students creates their Fee Assignments, and a Student never owes one Fee twice", async () => {
    const s = await feesSchool();
    const { id: feeId } = await s.newFee();

    expect(await applyFeeToStudents(s.asAdmin, { feeId, studentIds: [s.chen, s.dana] })).toEqual({ assigned: 2 });
    expect(await applyFeeToGrade(s.asAdmin, { feeId, gradeId: s.grade7.id })).toEqual({ assigned: 2 });
    expect(await applyFeeToGrade(s.asAdmin, { feeId, gradeId: s.grade7.id })).toEqual({ assigned: 0 });
    expect(await applyFeeToStudents(s.asAdmin, { feeId, studentIds: [s.aisha, s.aisha] })).toEqual({ assigned: 0 });

    expect(who(await getFee(s.asAdmin, { feeId })).map(([name]) => name)).toEqual([
      "Aisha Rahman",
      "Bilal Khan",
      "Chen Li",
      "Dana Saleh",
    ]);
  });

  it("applying a Fee needs an existing Fee, Grade and Students", async () => {
    const s = await feesSchool();
    const { id: feeId } = await s.newFee();

    await expect(applyFeeToGrade(s.asAdmin, { feeId: 9999, gradeId: s.grade7.id })).rejects.toThrow(NotFound);
    await expect(applyFeeToGrade(s.asAdmin, { feeId, gradeId: 9999 })).rejects.toThrow(NotFound);
    await expect(applyFeeToStudents(s.asAdmin, { feeId, studentIds: [s.aisha, "nobody"] })).rejects.toThrow(NotFound);
    await expect(applyFeeToStudents(s.asAdmin, { feeId, studentIds: [s.huda.userId] })).rejects.toThrow(NotFound);
    await expect(getFee(s.asAdmin, { feeId: 9999 })).rejects.toThrow(NotFound);
    expect((await getFee(s.asAdmin, { feeId })).assignments).toEqual([]);
  });

  it("a Grade's Students are those whose Enrollment in it hasn't ended by today, including one starting later", async () => {
    const s = await feesSchool(); // today 2026-10-01
    await promoteClass(s.asAdmin, { classId: s.class7A.id, leaving: [{ studentId: s.aisha, lastDay: "2026-09-20" }] });
    await enrollStudent(s.asAdmin, { studentId: s.dana, classId: s.class7B.id, startDate: "2026-11-01" });
    const { id: feeId } = await s.newFee();

    await applyFeeToGrade(s.asAdmin, { feeId, gradeId: s.grade7.id });

    expect(who(await getFee(s.asAdmin, { feeId })).map(([name]) => name)).toEqual(["Bilal Khan", "Dana Saleh"]);
  });

  it("the choices for applying a Fee are every Grade and the Students who don't owe it yet", async () => {
    const s = await feesSchool();
    const { id: feeId } = await s.newFee();
    await applyFeeToStudents(s.asAdmin, { feeId, studentIds: [s.bilal] });

    const choices = await feeApplyChoices(s.asAdmin, { feeId });

    expect(choices.grades.map((g) => g.name)).toEqual(["Grade 7", "Grade 8"]);
    expect(choices.students.map((st) => [st.name, st.studentNumber])).toEqual([
      ["Aisha Rahman", "S-1"],
      ["Chen Li", "S-3"],
      ["Dana Saleh", "S-4"],
    ]);
    await expect(feeApplyChoices(s.app.as(s.huda), { feeId })).rejects.toThrow(AccessDenied);
  });
});

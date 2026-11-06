import { describe, expect, it } from "vitest";
import { enrollmentSchool } from "../enrollment/test-enrollment";
import { InvalidInput } from "../errors";
import { createFee, listFees } from "./fees";

describe("Fees", () => {
  it("an Admin defines a Fee with its name, amount in AED and due date", async () => {
    const s = await enrollmentSchool();

    await createFee(s.asAdmin, { name: "Term 1 Tuition", amount: "12,500.50", dueDate: "2026-09-30" });

    expect(await listFees(s.asAdmin)).toEqual([
      expect.objectContaining({ name: "Term 1 Tuition", amountFils: 1_250_050, dueDate: "2026-09-30" }),
    ]);
  });

  it("a Fee needs a name, an amount above zero with at most two decimals, and a real due date", async () => {
    const s = await enrollmentSchool();
    const define = (over: Partial<{ name: string; amount: string; dueDate: string }>) =>
      createFee(s.asAdmin, { name: "Bus", amount: "300", dueDate: "2026-10-01", ...over });

    await expect(define({ name: "  " })).rejects.toThrow(new InvalidInput("errors.feeNameRequired"));
    for (const amount of ["0", "0.00", "-5", "12.345", "abc", "", "1,50"]) {
      await expect(define({ amount })).rejects.toThrow(new InvalidInput("errors.feeAmountInvalid"));
    }
    for (const dueDate of ["2026-02-30", "soon"]) {
      await expect(define({ dueDate })).rejects.toThrow(new InvalidInput("errors.feeDueDateInvalid"));
    }
    await define({ amount: "0.5" });
    expect((await listFees(s.asAdmin)).map((f) => f.amountFils)).toEqual([50]);
  });
});

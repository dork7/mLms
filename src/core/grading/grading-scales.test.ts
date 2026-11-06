import { describe, expect, test } from "vitest";
import { school } from "../classes/test-school";
import { AccessDenied, InvalidInput, NotFound } from "../errors";
import { createGrade } from "../school/catalogue";
import { getGradingScale, listGradingScales, setGradingScale } from "./grading-scales";

const lettersScale = {
  passMark: 50,
  bands: [
    { minPercent: 80, label: "A" },
    { minPercent: 50, label: "B" },
    { minPercent: 0, label: "F" },
  ],
};

describe("Grading Scales", () => {
  test("an Admin defines a Grade's Grading Scale, and it reads back with bands highest first", async () => {
    const s = await school();
    await setGradingScale(s.asAdmin, {
      gradeId: s.grade7.id,
      passMark: 40,
      bands: [
        { minPercent: 0, label: " Needs work " },
        { minPercent: 75, label: "Excellent" },
        { minPercent: 40, label: "Good" },
      ],
    });

    expect(await getGradingScale(s.asAdmin, { gradeId: s.grade7.id })).toEqual({
      passMark: 40,
      bands: [
        { minPercent: 75, label: "Excellent" },
        { minPercent: 40, label: "Good" },
        { minPercent: 0, label: "Needs work" },
      ],
    });
  });

  test("a Grade has no Grading Scale until the Admin defines one", async () => {
    const s = await school();
    expect(await getGradingScale(s.asAdmin, { gradeId: s.grade7.id })).toBeNull();
  });

  test("saving again replaces the Grade's Grading Scale", async () => {
    const s = await school();
    await setGradingScale(s.asAdmin, { gradeId: s.grade7.id, ...lettersScale });
    await setGradingScale(s.asAdmin, {
      gradeId: s.grade7.id,
      passMark: 60,
      bands: [{ minPercent: 0, label: "Pass or fail" }],
    });

    expect(await getGradingScale(s.asAdmin, { gradeId: s.grade7.id })).toEqual({
      passMark: 60,
      bands: [{ minPercent: 0, label: "Pass or fail" }],
    });
  });

  test("younger and older Grades have their own Grading Scales", async () => {
    const s = await school();
    const grade8 = await createGrade(s.asAdmin, { name: "Grade 8" });
    await setGradingScale(s.asAdmin, { gradeId: s.grade7.id, ...lettersScale });
    await setGradingScale(s.asAdmin, {
      gradeId: grade8.id,
      passMark: 65,
      bands: [{ minPercent: 0, label: "Graded" }],
    });

    expect(await listGradingScales(s.asAdmin)).toEqual([
      { gradeId: s.grade7.id, grade: "Grade 7", scale: lettersScale },
      { gradeId: grade8.id, grade: "Grade 8", scale: { passMark: 65, bands: [{ minPercent: 0, label: "Graded" }] } },
    ]);
  });

  test("the list shows a Grade with no Grading Scale yet", async () => {
    const s = await school();
    expect(await listGradingScales(s.asAdmin)).toEqual([{ gradeId: s.grade7.id, grade: "Grade 7", scale: null }]);
  });

  test.each([
    ["no bands", { passMark: 50, bands: [] }, "errors.gradingBandsRequired"],
    ["a blank label", { passMark: 50, bands: [{ minPercent: 0, label: "  " }] }, "errors.gradingBandLabelRequired"],
    [
      "a band above 100",
      { passMark: 50, bands: [{ minPercent: 0, label: "F" }, { minPercent: 101, label: "A" }] },
      "errors.gradingBandPercentInvalid",
    ],
    ["a negative band", { passMark: 50, bands: [{ minPercent: -1, label: "F" }] }, "errors.gradingBandPercentInvalid"],
    [
      "a band that isn't a number",
      { passMark: 50, bands: [{ minPercent: Number.NaN, label: "F" }] },
      "errors.gradingBandPercentInvalid",
    ],
    [
      "a band with three decimals",
      { passMark: 50, bands: [{ minPercent: 0, label: "F" }, { minPercent: 50.125, label: "A" }] },
      "errors.gradingBandPercentInvalid",
    ],
    [
      "two bands starting at the same percentage",
      { passMark: 50, bands: [{ minPercent: 0, label: "F" }, { minPercent: 0, label: "A" }] },
      "errors.gradingBandsDuplicate",
    ],
    [
      "a lowest band above 0, leaving low percentages with no label",
      { passMark: 50, bands: [{ minPercent: 10, label: "F" }] },
      "errors.gradingBandsMustStartAtZero",
    ],
    ["a pass mark above 100", { passMark: 101, bands: [{ minPercent: 0, label: "F" }] }, "errors.gradingPassMarkInvalid"],
    ["a negative pass mark", { passMark: -1, bands: [{ minPercent: 0, label: "F" }] }, "errors.gradingPassMarkInvalid"],
    [
      "a pass mark that isn't a number",
      { passMark: Number.NaN, bands: [{ minPercent: 0, label: "F" }] },
      "errors.gradingPassMarkInvalid",
    ],
  ])("a Grading Scale with %s is refused and the old one stays", async (_name, scale, messageKey) => {
    const s = await school();
    await setGradingScale(s.asAdmin, { gradeId: s.grade7.id, ...lettersScale });

    const refusal = await setGradingScale(s.asAdmin, { gradeId: s.grade7.id, ...scale }).catch((e) => e);
    expect(refusal).toBeInstanceOf(InvalidInput);
    expect(refusal.messageKey).toBe(messageKey);
    expect(await getGradingScale(s.asAdmin, { gradeId: s.grade7.id })).toEqual(lettersScale);
  });

  test("a Grading Scale for an unknown Grade is refused", async () => {
    const s = await school();
    await expect(setGradingScale(s.asAdmin, { gradeId: 99999, ...lettersScale })).rejects.toThrow(NotFound);
  });

  test("a Teacher or Student can't define a Grading Scale or open the Admin's list", async () => {
    const s = await school();
    const student = s.app.as({ role: "student", userId: "x" });
    await expect(setGradingScale(s.app.as(s.sara), { gradeId: s.grade7.id, ...lettersScale })).rejects.toThrow(AccessDenied);
    await expect(setGradingScale(student, { gradeId: s.grade7.id, ...lettersScale })).rejects.toThrow(AccessDenied);
    await expect(listGradingScales(s.app.as(s.sara))).rejects.toThrow(AccessDenied);
    await expect(getGradingScale(student, { gradeId: s.grade7.id })).rejects.toThrow(AccessDenied);
  });
});

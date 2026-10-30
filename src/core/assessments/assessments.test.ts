import { describe, expect, test } from "vitest";
import { enrollStudent } from "../enrollment/enrollment";
import { AccessDenied, InvalidInput, NotFound } from "../errors";
import { registerStudent } from "../students/register-student";
import { createAssessment, listAssessments, updateAssessment } from "./assessments";
import { marksGrid, saveMarks } from "./marks";
import { assessmentSchool, quiz } from "./test-assessments";

describe("creating an Assessment", () => {
  test("a Subject Teacher creates an Assessment and its Term is worked out from its date", async () => {
    const s = await assessmentSchool();
    await createAssessment(s.asSara, quiz(s.math7A.id, { date: "2026-09-20" }));
    await createAssessment(s.asSara, {
      classSubjectId: s.math7A.id,
      type: "midterm",
      date: "2027-02-10",
      maxMarks: 50,
      weight: 2.5,
    });

    const list = await listAssessments(s.asSara, { classSubjectId: s.math7A.id });
    expect(list.map((a) => [a.type, a.date, a.term, a.maxMarks, a.weight])).toEqual([
      ["midterm", "2027-02-10", "Term 2", 50, 2.5],
      ["quiz", "2026-09-20", "Term 1", 10, 1],
    ]);
  });

  test("an Assessment dated outside the Class's Academic Year is refused", async () => {
    const s = await assessmentSchool();
    await expect(createAssessment(s.asSara, quiz(s.math7A.id, { date: "2027-07-01" }))).rejects.toThrow(
      expect.objectContaining({ messageKey: "errors.assessmentDateOutsideYear" }),
    );
    await expect(createAssessment(s.asSara, quiz(s.math7A.id, { date: "2026-02-30" }))).rejects.toThrow(
      InvalidInput,
    );
  });

  test("maximum marks and weight must be positive, and the type one of the four", async () => {
    const s = await assessmentSchool();
    await expect(createAssessment(s.asSara, quiz(s.math7A.id, { maxMarks: 0 }))).rejects.toThrow(
      expect.objectContaining({ messageKey: "errors.assessmentMaxMarksInvalid" }),
    );
    await expect(createAssessment(s.asSara, quiz(s.math7A.id, { weight: -1 }))).rejects.toThrow(
      expect.objectContaining({ messageKey: "errors.assessmentWeightInvalid" }),
    );
    await expect(
      createAssessment(s.asSara, { ...quiz(s.math7A.id), type: "test" as "quiz" }),
    ).rejects.toThrow(expect.objectContaining({ messageKey: "errors.assessmentTypeInvalid" }));
  });

  test("only the Subject Teacher creates Assessments: the Class Teacher, another Teacher and the Admin are refused", async () => {
    const s = await assessmentSchool();
    await expect(createAssessment(s.asHuda, quiz(s.math7A.id))).rejects.toThrow(AccessDenied);
    await expect(createAssessment(s.asOmar, quiz(s.math7A.id))).rejects.toThrow(AccessDenied);
    await expect(createAssessment(s.asAdmin, quiz(s.math7A.id))).rejects.toThrow(AccessDenied);
    await expect(createAssessment(s.asSara, quiz(9999))).rejects.toThrow(NotFound);
  });

  test("the Class Teacher and the Admin see a Class Subject's Assessments; another Teacher is refused", async () => {
    const s = await assessmentSchool();
    await createAssessment(s.asSara, quiz(s.math7A.id));
    expect(await listAssessments(s.asHuda, { classSubjectId: s.math7A.id })).toHaveLength(1);
    expect(await listAssessments(s.asAdmin, { classSubjectId: s.math7A.id })).toHaveLength(1);
    await expect(listAssessments(s.asOmar, { classSubjectId: s.math7A.id })).rejects.toThrow(AccessDenied);
    await expect(
      listAssessments(s.app.as({ role: "student", userId: s.aisha }), { classSubjectId: s.math7A.id }),
    ).rejects.toThrow(AccessDenied);
  });
});

describe("statistics and later changes", () => {
  test("each Assessment shows its average, highest and lowest Marks; Absent counts as zero and Exempt is left out", async () => {
    const s = await assessmentSchool();
    const { studentId: carla } = await registerStudent(s.asAdmin, {
      name: "Carla Diaz",
      studentNumber: "S-3",
      dateOfBirth: "2013-01-01",
      nationalId: "784-S-3",
      guardianContact: "Guardian",
      admissionDate: "2026-08-25",
    });
    await enrollStudent(s.asAdmin, { studentId: carla, classId: s.class7A.id, startDate: "2026-09-01" });
    const a = await createAssessment(s.asSara, quiz(s.math7A.id, { maxMarks: 20 }));
    const empty = await createAssessment(s.asSara, quiz(s.math7A.id, { date: "2026-10-01" }));
    await saveMarks(s.asSara, {
      assessmentId: a.id,
      marks: [
        { studentId: s.aisha, mark: 18 },
        { studentId: s.bilal, mark: "absent" },
        { studentId: carla, mark: "exempt" },
      ],
    });

    const list = await listAssessments(s.asHuda, { classSubjectId: s.math7A.id });
    expect(list.find((x) => x.id === a.id)!.stats).toEqual({ counted: 2, average: 9, highest: 18, lowest: 0 });
    expect(list.find((x) => x.id === empty.id)!.stats).toEqual({
      counted: 0,
      average: null,
      highest: null,
      lowest: null,
    });
  });

  test("maximum marks and weight can change after Marks are entered: raw Marks are kept and percentages recalculated", async () => {
    const s = await assessmentSchool();
    const a = await createAssessment(s.asSara, quiz(s.math7A.id, { maxMarks: 10, weight: 1 }));
    await saveMarks(s.asSara, {
      assessmentId: a.id,
      marks: [
        { studentId: s.aisha, mark: 8 },
        { studentId: s.bilal, mark: "absent" },
      ],
    });
    expect((await marksGrid(s.asSara, { assessmentId: a.id })).rows.map((r) => r.percent)).toEqual([80, 0]);

    await updateAssessment(s.asSara, { assessmentId: a.id, maxMarks: 16, weight: 3 });

    const grid = await marksGrid(s.asSara, { assessmentId: a.id });
    expect([grid.assessment.maxMarks, grid.assessment.weight]).toEqual([16, 3]);
    expect(grid.rows.map((r) => [r.mark, r.percent])).toEqual([
      [8, 50],
      ["absent", 0],
    ]);
  });

  test("the maximum can't drop below a Mark already entered, and only the Subject Teacher changes an Assessment", async () => {
    const s = await assessmentSchool();
    const a = await createAssessment(s.asSara, quiz(s.math7A.id, { maxMarks: 10 }));
    await saveMarks(s.asSara, { assessmentId: a.id, marks: [{ studentId: s.aisha, mark: 9 }] });
    await expect(updateAssessment(s.asSara, { assessmentId: a.id, maxMarks: 8, weight: 1 })).rejects.toThrow(
      expect.objectContaining({ messageKey: "errors.assessmentMaxBelowMark" }),
    );
    await expect(updateAssessment(s.asSara, { assessmentId: a.id, maxMarks: 10, weight: 0 })).rejects.toThrow(
      expect.objectContaining({ messageKey: "errors.assessmentWeightInvalid" }),
    );
    await expect(updateAssessment(s.asHuda, { assessmentId: a.id, maxMarks: 20, weight: 1 })).rejects.toThrow(
      AccessDenied,
    );
    await expect(updateAssessment(s.asAdmin, { assessmentId: a.id, maxMarks: 20, weight: 1 })).rejects.toThrow(
      AccessDenied,
    );
  });
});

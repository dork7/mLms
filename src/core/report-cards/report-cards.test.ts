import { describe, expect, test } from "vitest";
import { createAssessment } from "../assessments/assessments";
import { type MarkValue, saveMarks } from "../assessments/marks";
import { assessmentSchool, quiz } from "../assessments/test-assessments";
import { createClassSubject, reassignSubjectTeacher } from "../classes/class-subjects";
import { enrollStudent, moveStudent } from "../enrollment/enrollment";
import { AccessDenied, NotFound } from "../errors";
import { studentTermGrades } from "../grading/term-grades";
import { updateAcademicYear } from "../school/academic-year";
import { yearEndSchool } from "../year-end/test-year-end";
import { promoteClass } from "../year-end/year-end";
import { createSubject } from "../school/catalogue";
import { getPeriodsPerDay, setPeriodsPerDay } from "../school/periods";
import { registerStudent } from "../students/register-student";
import { getRankEnabled, setRankEnabled } from "./rank-setting";
import { overallRemarkSheet, saveOverallRemark, saveSubjectRemark, subjectRemarkSheet } from "./remarks";
import { classReportCards } from "./report-cards";

type School = Awaited<ReturnType<typeof assessmentSchool>>;

/** An Assessment in a Class Subject with one Student's Mark, entered by its Subject Teacher. */
async function marked(
  s: School,
  classSubjectId: number,
  studentId: string,
  value: MarkValue,
  teacher = s.asSara,
  date = "2026-09-20",
  over: Parameters<typeof quiz>[1] = {},
) {
  const { id } = await createAssessment(teacher, quiz(classSubjectId, { date, ...over }));
  await saveMarks(teacher, { assessmentId: id, marks: [{ studentId, mark: value }] });
  return id;
}

/** Gives 7-A a second Subject, taught by Sara. */
function scienceFor7A(s: School) {
  return createClassSubject(s.asAdmin, { classId: s.class7A.id, subjectId: s.science.id, teacherId: s.sara.userId });
}

async function term1(s: School) {
  return (await classReportCards(s.asAdmin, { classId: s.class7A.id })).term;
}

async function cardOf(s: School, classId: number, studentId: string) {
  const { cards } = await classReportCards(s.asAdmin, { classId });
  const card = cards.find((c) => c.studentId === studentId);
  if (!card) throw new Error("no Report Card for this Student");
  return card;
}

describe("Subject Teacher remarks", () => {
  test("a Subject Teacher's remark shows on the Student's Report Card beside the Term Grade", async () => {
    const s = await assessmentSchool();
    await marked(s, s.math7A.id, s.aisha, 8);
    const term = await term1(s);

    await saveSubjectRemark(s.asSara, {
      classSubjectId: s.math7A.id,
      termId: term.id,
      studentId: s.aisha,
      remark: "  Strong on fractions.  ",
    });

    const card = await cardOf(s, s.class7A.id, s.aisha);
    expect(card.grades).toHaveLength(1);
    expect(card.grades[0]).toMatchObject({ subject: "Math", percent: 80, remark: "Strong on fractions." });
  });

  test("another Teacher, the Class Teacher and the Admin are refused a Subject Teacher's remark", async () => {
    const s = await assessmentSchool();
    const term = await term1(s);
    const input = { classSubjectId: s.math7A.id, termId: term.id, studentId: s.aisha, remark: "Fine." };

    await expect(saveSubjectRemark(s.asOmar, input)).rejects.toThrow(AccessDenied);
    await expect(saveSubjectRemark(s.asHuda, input)).rejects.toThrow(AccessDenied);
    await expect(saveSubjectRemark(s.asAdmin, input)).rejects.toThrow(AccessDenied);
  });

  test("a Teacher gets one remark per Student per Subject: saving again replaces it", async () => {
    const s = await assessmentSchool();
    await marked(s, s.math7A.id, s.aisha, 8);
    const term = await term1(s);
    const input = { classSubjectId: s.math7A.id, termId: term.id, studentId: s.aisha };

    await saveSubjectRemark(s.asSara, { ...input, remark: "First thought." });
    await saveSubjectRemark(s.asSara, { ...input, remark: "Second thought." });

    expect((await cardOf(s, s.class7A.id, s.aisha)).grades[0].remark).toBe("Second thought.");
  });

  test("saving a blank remark clears it, so it can't pass for one", async () => {
    const s = await assessmentSchool();
    await marked(s, s.math7A.id, s.aisha, 8);
    const term = await term1(s);
    const input = { classSubjectId: s.math7A.id, termId: term.id, studentId: s.aisha };

    await saveSubjectRemark(s.asSara, { ...input, remark: "Written too soon." });
    await saveSubjectRemark(s.asSara, { ...input, remark: "   " });

    expect((await cardOf(s, s.class7A.id, s.aisha)).grades[0].remark).toBeNull();
  });

  test("a remark over 1000 characters is refused, and one of exactly 1000 is kept", async () => {
    const s = await assessmentSchool();
    const term = await term1(s);
    const input = { classSubjectId: s.math7A.id, termId: term.id, studentId: s.aisha };

    await expect(saveSubjectRemark(s.asSara, { ...input, remark: "x".repeat(1001) })).rejects.toMatchObject({
      messageKey: "errors.remarkTooLong",
    });
    await saveSubjectRemark(s.asSara, { ...input, remark: "x".repeat(1000) });

    expect((await cardOf(s, s.class7A.id, s.aisha)).grades[0].remark).toHaveLength(1000);
  });

  test("a Subject Teacher is refused a remark for a Student never in their Class", async () => {
    const s = await assessmentSchool();
    const term = await term1(s);

    await expect(
      saveSubjectRemark(s.asSara, { classSubjectId: s.math7B.id, termId: term.id, studentId: s.aisha, remark: "No." }),
    ).rejects.toThrow(AccessDenied);
  });

  test("a Term of another Academic Year is not found", async () => {
    const s = await assessmentSchool();

    await expect(
      saveSubjectRemark(s.asSara, { classSubjectId: s.math7A.id, termId: 999999, studentId: s.aisha, remark: "No." }),
    ).rejects.toThrow(NotFound);
  });

  test("the new Subject Teacher takes over the remarks when a Class Subject is reassigned", async () => {
    const s = await assessmentSchool();
    const term = await term1(s);
    await reassignSubjectTeacher(s.asAdmin, { classSubjectId: s.math7A.id, teacherId: s.omar.userId });
    const input = { classSubjectId: s.math7A.id, termId: term.id, studentId: s.aisha, remark: "From Omar." };

    await expect(saveSubjectRemark(s.asSara, input)).rejects.toThrow(AccessDenied);
    await saveSubjectRemark(s.asOmar, input);

    expect((await cardOf(s, s.class7A.id, s.aisha)).grades[0]).toMatchObject({ remark: "From Omar.", teacher: "Omar" });
  });
});

describe("the Issuing Class", () => {
  test("Aisha moves from 7-A to 7-B in week 6: 7-B issues her Report Card, with her 7-A Marks in it", async () => {
    const s = await assessmentSchool();
    await marked(s, s.math7A.id, s.aisha, 8);
    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-10-12" });
    await marked(s, s.math7B.id, s.aisha, 4, s.asSara, "2026-10-14");

    const a = await classReportCards(s.asAdmin, { classId: s.class7A.id });
    expect(a.cards.map((c) => c.name)).toEqual(["Bilal Khan"]);

    const b = await classReportCards(s.asAdmin, { classId: s.class7B.id });
    expect(b.cards.map((c) => c.name)).toEqual(["Aisha Rahman"]);
    expect(b.cards[0].issuingClass.name).toBe("7-B");
    // (8/10 + 4/10) ÷ 2
    expect(b.cards[0].grades.find((g) => g.subject === "Math")?.percent).toBe(60);
  });

  test("the Issuing Class goes by the Term's last day, not by today", async () => {
    const s = await assessmentSchool();
    // Today is 2026-10-20; this move is after it, but before Term 1 ends on 2026-12-31.
    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-12-01" });

    const a = await classReportCards(s.asAdmin, { classId: s.class7A.id });
    expect(a.cards.map((c) => c.name)).toEqual(["Bilal Khan"]);
    const b = await classReportCards(s.asAdmin, { classId: s.class7B.id });
    expect(b.cards.map((c) => c.name)).toEqual(["Aisha Rahman"]);
  });

  test("a Student who joins on the Term's last day is on that Report Card; one who moves the next day is not", async () => {
    const s = await assessmentSchool();
    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-12-31" });
    await moveStudent(s.asAdmin, { studentId: s.bilal, classId: s.class7B.id, date: "2027-01-01" });

    const a = await classReportCards(s.asAdmin, { classId: s.class7A.id });
    expect(a.cards.map((c) => c.name)).toEqual(["Bilal Khan"]);
    const b = await classReportCards(s.asAdmin, { classId: s.class7B.id });
    expect(b.cards.map((c) => c.name)).toEqual(["Aisha Rahman"]);
  });

  test("the Subject remark on a moved Student falls to the Subject Teacher in the Issuing Class", async () => {
    const s = await assessmentSchool();
    await reassignSubjectTeacher(s.asAdmin, { classSubjectId: s.math7B.id, teacherId: s.omar.userId });
    await marked(s, s.math7A.id, s.aisha, 8);
    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-10-12" });
    const term = await term1(s);

    await expect(
      saveSubjectRemark(s.asSara, { classSubjectId: s.math7A.id, termId: term.id, studentId: s.aisha, remark: "No." }),
    ).rejects.toThrow(AccessDenied);
    await saveSubjectRemark(s.asOmar, {
      classSubjectId: s.math7B.id,
      termId: term.id,
      studentId: s.aisha,
      remark: "Settled in well.",
    });

    const math = (await cardOf(s, s.class7B.id, s.aisha)).grades.find((g) => g.subject === "Math");
    expect(math).toMatchObject({ percent: 80, remark: "Settled in well.", teacher: "Omar" });
  });

  test("a Subject only the old Class had still has someone to write its remark", async () => {
    const s = await assessmentSchool();
    const history7A = await createClassSubject(s.asAdmin, {
      classId: s.class7A.id,
      subjectId: (await createSubject(s.asAdmin, { name: "History" })).id,
      teacherId: s.sara.userId,
    });
    await marked(s, history7A.id, s.aisha, 9);
    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-10-12" });
    const term = await term1(s);

    await saveSubjectRemark(s.asSara, {
      classSubjectId: history7A.id,
      termId: term.id,
      studentId: s.aisha,
      remark: "Good essays before the move.",
    });

    const history = (await cardOf(s, s.class7B.id, s.aisha)).grades.find((g) => g.subject === "History");
    expect(history).toMatchObject({ percent: 90, remark: "Good essays before the move.", teacher: "Sara" });
  });

  test("a remark written before a backdated move doesn't follow the Student onto the new Issuing Class's card", async () => {
    const s = await assessmentSchool();
    await marked(s, s.math7A.id, s.aisha, 8);
    const term = await term1(s);
    await saveSubjectRemark(s.asSara, {
      classSubjectId: s.math7A.id,
      termId: term.id,
      studentId: s.aisha,
      remark: "From 7-A's Math.",
    });
    await saveOverallRemark(s.asHuda, { classId: s.class7A.id, termId: term.id, studentId: s.aisha, remark: "From Huda." });

    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-09-10" });

    const card = await cardOf(s, s.class7B.id, s.aisha);
    expect(card.overallRemark).toBeNull();
    expect(card.grades.find((g) => g.subject === "Math")?.remark).toBeNull();
  });
});

describe("the Class Teacher's overall remark", () => {
  test("the Issuing Class's Class Teacher writes one overall remark per Student", async () => {
    const s = await assessmentSchool();
    const term = await term1(s);
    const input = { classId: s.class7A.id, termId: term.id, studentId: s.aisha };

    await saveOverallRemark(s.asHuda, { ...input, remark: "A good start." });
    await saveOverallRemark(s.asHuda, { ...input, remark: "  A very good start. " });

    expect((await cardOf(s, s.class7A.id, s.aisha)).overallRemark).toBe("A very good start.");
  });

  test("a blank overall remark clears it", async () => {
    const s = await assessmentSchool();
    const term = await term1(s);
    const input = { classId: s.class7A.id, termId: term.id, studentId: s.aisha };

    await saveOverallRemark(s.asHuda, { ...input, remark: "Written too soon." });
    await saveOverallRemark(s.asHuda, { ...input, remark: "" });

    expect((await cardOf(s, s.class7A.id, s.aisha)).overallRemark).toBeNull();
  });

  test("a Subject Teacher, another Class Teacher, the Admin and a Student are refused the overall remark", async () => {
    const s = await assessmentSchool();
    const term = await term1(s);
    const input = { classId: s.class7A.id, termId: term.id, studentId: s.aisha, remark: "No." };

    await expect(saveOverallRemark(s.asSara, input)).rejects.toThrow(AccessDenied);
    await expect(saveOverallRemark(s.asOmar, input)).rejects.toThrow(AccessDenied);
    await expect(saveOverallRemark(s.asAdmin, input)).rejects.toThrow(AccessDenied);
    await expect(saveOverallRemark(s.app.as({ role: "student", userId: s.aisha }), input)).rejects.toThrow(AccessDenied);
  });

  test("after Aisha moves, her old Class Teacher is refused and the Issuing Class's Class Teacher writes it", async () => {
    const s = await assessmentSchool();
    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-10-12" });
    const term = await term1(s);

    await expect(
      saveOverallRemark(s.asHuda, { classId: s.class7A.id, termId: term.id, studentId: s.aisha, remark: "No." }),
    ).rejects.toThrow(AccessDenied);
    await saveOverallRemark(s.asOmar, {
      classId: s.class7B.id,
      termId: term.id,
      studentId: s.aisha,
      remark: "Settled in well.",
    });

    expect((await cardOf(s, s.class7B.id, s.aisha)).overallRemark).toBe("Settled in well.");
  });
});

describe("the overall percentage", () => {
  test("it's the plain average of the Term Grade percentages, whatever the Assessment weights", async () => {
    const s = await assessmentSchool();
    const science = await scienceFor7A(s);
    await marked(s, s.math7A.id, s.aisha, 9, s.asSara, "2026-09-20", { weight: 50 });
    await marked(s, science.id, s.aisha, 6, s.asSara, "2026-09-20", { weight: 1 });

    // (90 + 60) ÷ 2, not weighted towards Math.
    expect((await cardOf(s, s.class7A.id, s.aisha)).overallPercent).toBe(75);
  });

  test("it averages the figures shown, to two decimals, rounding half up", async () => {
    const s = await assessmentSchool();
    const science = await scienceFor7A(s);
    await marked(s, s.math7A.id, s.aisha, 1, s.asSara, "2026-09-20", { maxMarks: 100 });
    await marked(s, science.id, s.aisha, 1.01, s.asSara, "2026-09-20", { maxMarks: 100 });

    // (1 + 1.01) ÷ 2 = 1.005, which in floating point sits just below the half.
    expect((await cardOf(s, s.class7A.id, s.aisha)).overallPercent).toBe(1.01);
  });

  test("a Subject with no percentage is skipped, not averaged as zero", async () => {
    const s = await assessmentSchool();
    const science = await scienceFor7A(s);
    await marked(s, s.math7A.id, s.aisha, 8);
    await marked(s, science.id, s.aisha, "exempt");

    expect((await cardOf(s, s.class7A.id, s.aisha)).overallPercent).toBe(80);
  });

  test("a Subject with no Assessment is skipped too", async () => {
    const s = await assessmentSchool();
    await scienceFor7A(s);
    await marked(s, s.math7A.id, s.aisha, 8);

    expect((await cardOf(s, s.class7A.id, s.aisha)).overallPercent).toBe(80);
  });

  test("an Absent Mark brings it down, because the Term Grade counts it as zero", async () => {
    const s = await assessmentSchool();
    const science = await scienceFor7A(s);
    await marked(s, s.math7A.id, s.aisha, 8);
    await marked(s, science.id, s.aisha, "absent");

    expect((await cardOf(s, s.class7A.id, s.aisha)).overallPercent).toBe(40);
  });

  test("with no Term Grade percentage at all, it's empty", async () => {
    const s = await assessmentSchool();

    expect((await cardOf(s, s.class7A.id, s.aisha)).overallPercent).toBeNull();
  });

  test("it combines Marks from both Classes for a Student who moved", async () => {
    const s = await assessmentSchool();
    await marked(s, s.math7A.id, s.aisha, 8);
    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-10-12" });
    await marked(s, s.math7B.id, s.aisha, 4, s.asSara, "2026-10-14");
    await marked(s, s.science7B.id, s.aisha, 10, s.asHuda, "2026-10-14");

    // Math (80 + 40) ÷ 2 = 60, Science 100, so (60 + 100) ÷ 2.
    expect((await cardOf(s, s.class7B.id, s.aisha)).overallPercent).toBe(80);
  });
});

describe("rank", () => {
  async function markAll(s: School, classSubjectId: number, marks: Record<string, MarkValue>, maxMarks = 10) {
    const { id } = await createAssessment(s.asSara, quiz(classSubjectId, { maxMarks }));
    await saveMarks(s.asSara, {
      assessmentId: id,
      marks: Object.entries(marks).map(([studentId, mark]) => ({ studentId, mark })),
    });
  }

  async function ranks(s: School, classId: number) {
    const { cards } = await classReportCards(s.asAdmin, { classId });
    return Object.fromEntries(cards.map((c) => [c.name, c.rank]));
  }

  async function thirdStudent(s: School, classId: number) {
    const { studentId } = await registerStudent(s.asAdmin, {
      name: "Carim Saleh",
      studentNumber: "S-3",
      dateOfBirth: "2013-04-12",
      nationalId: "784-S-3",
      guardianContact: "Guardian",
      admissionDate: "2026-08-25",
    });
    await enrollStudent(s.asAdmin, { studentId, classId, startDate: "2026-09-01" });
    return studentId;
  }

  test("rank is off until the Admin turns it on, and the layer leaves it out", async () => {
    const s = await assessmentSchool();
    await markAll(s, s.math7A.id, { [s.aisha]: 9, [s.bilal]: 7 });

    const preview = await classReportCards(s.asAdmin, { classId: s.class7A.id });
    expect(preview.rankEnabled).toBe(false);
    expect(preview.cards.map((c) => c.rank)).toEqual([null, null]);
    expect(await getRankEnabled(s.asAdmin)).toBe(false);
  });

  test("turned on, rank orders the Issuing Class by overall percentage; turned off again, it's gone", async () => {
    const s = await assessmentSchool();
    await markAll(s, s.math7A.id, { [s.aisha]: 7, [s.bilal]: 9 });

    await setRankEnabled(s.asAdmin, true);
    expect(await ranks(s, s.class7A.id)).toEqual({ "Aisha Rahman": 2, "Bilal Khan": 1 });

    await setRankEnabled(s.asAdmin, false);
    expect(await ranks(s, s.class7A.id)).toEqual({ "Aisha Rahman": null, "Bilal Khan": null });
  });

  test("tied Students share a rank, and the next Student's rank skips past them", async () => {
    const s = await assessmentSchool();
    const carim = await thirdStudent(s, s.class7A.id);
    await markAll(s, s.math7A.id, { [s.aisha]: 9, [s.bilal]: 9, [carim]: 5 });

    await setRankEnabled(s.asAdmin, true);

    expect(await ranks(s, s.class7A.id)).toEqual({ "Aisha Rahman": 1, "Bilal Khan": 1, "Carim Saleh": 3 });
  });

  test("Students whose shown percentages match are tied, even if the raw figures differ past two decimals", async () => {
    const s = await assessmentSchool();
    await markAll(s, s.math7A.id, { [s.aisha]: 1, [s.bilal]: "exempt" }, 3); // 33.33% for Aisha
    await markAll(s, s.math7A.id, { [s.aisha]: "exempt", [s.bilal]: 33.33 }, 100); // 33.33% for Bilal

    await setRankEnabled(s.asAdmin, true);

    expect(await ranks(s, s.class7A.id)).toEqual({ "Aisha Rahman": 1, "Bilal Khan": 1 });
  });

  test("a Student with no overall percentage has no rank and takes no place", async () => {
    const s = await assessmentSchool();
    const carim = await thirdStudent(s, s.class7A.id);
    await markAll(s, s.math7A.id, { [s.aisha]: 9, [s.bilal]: 5 });

    await setRankEnabled(s.asAdmin, true);

    const after = await classReportCards(s.asAdmin, { classId: s.class7A.id });
    expect(after.cards.find((c) => c.studentId === carim)?.rank).toBeNull();
    expect(await ranks(s, s.class7A.id)).toMatchObject({ "Aisha Rahman": 1, "Bilal Khan": 2 });
  });

  test("rank is within the Issuing Class only, with a moved Student ranked where the card is issued", async () => {
    const s = await assessmentSchool();
    // Bilal stays in 7-A with 50%. Aisha is marked 100% in 7-A, then moves to 7-B.
    await markAll(s, s.math7A.id, { [s.aisha]: 10, [s.bilal]: 5 });
    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-10-12" });

    await setRankEnabled(s.asAdmin, true);

    expect(await ranks(s, s.class7A.id)).toEqual({ "Bilal Khan": 1 });
    expect(await ranks(s, s.class7B.id)).toEqual({ "Aisha Rahman": 1 });
  });

  test("only the Admin can switch rank", async () => {
    const s = await assessmentSchool();

    await expect(setRankEnabled(s.asHuda, true)).rejects.toThrow(AccessDenied);
    await expect(setRankEnabled(s.app.as({ role: "student", userId: s.aisha }), true)).rejects.toThrow(AccessDenied);
  });

  test("switching rank leaves the number of Periods alone, and the other way round", async () => {
    const s = await assessmentSchool();
    await setPeriodsPerDay(s.asAdmin, 6);

    await setRankEnabled(s.asAdmin, true);
    expect(await getPeriodsPerDay(s.asAdmin)).toBe(6);

    await setPeriodsPerDay(s.asAdmin, 7);
    expect(await getRankEnabled(s.asAdmin)).toBe(true);
  });
});

describe("what the Admin's preview flags", () => {
  test("a Term Grade with Assessments still to be marked is flagged with how many", async () => {
    const s = await assessmentSchool();
    await marked(s, s.math7A.id, s.aisha, 8);
    await createAssessment(s.asSara, quiz(s.math7A.id));
    await createAssessment(s.asSara, quiz(s.math7A.id));

    const { flags } = await cardOf(s, s.class7A.id, s.aisha);
    expect(flags).toContainEqual({ kind: "missingMarks", subject: "Math", count: 2 });
  });

  test("Absent and Exempt are Marks, so they aren't flagged as missing", async () => {
    const s = await assessmentSchool();
    await marked(s, s.math7A.id, s.aisha, "absent");
    await marked(s, s.math7A.id, s.aisha, "exempt");

    const { flags } = await cardOf(s, s.class7A.id, s.aisha);
    expect(flags.filter((f) => f.kind === "missingMarks")).toEqual([]);
  });

  test("a Mark missing from the old Class is flagged on the new Issuing Class's card", async () => {
    const s = await assessmentSchool();
    await createAssessment(s.asSara, quiz(s.math7A.id));
    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-10-12" });

    const { flags } = await cardOf(s, s.class7B.id, s.aisha);
    expect(flags).toContainEqual({ kind: "missingMarks", subject: "Math", count: 1 });
  });

  test("an Assessment on a date before the Student joined isn't flagged", async () => {
    const s = await assessmentSchool();
    await createAssessment(s.asSara, quiz(s.math7B.id, { date: "2026-09-05" }));
    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-10-12" });

    const { flags } = await cardOf(s, s.class7B.id, s.aisha);
    expect(flags.filter((f) => f.kind === "missingMarks")).toEqual([]);
  });

  test("an Assessment in another Term isn't flagged", async () => {
    const s = await assessmentSchool();
    await createAssessment(s.asSara, quiz(s.math7A.id, { date: "2027-02-01" }));

    const { flags } = await cardOf(s, s.class7A.id, s.aisha);
    expect(flags).not.toContainEqual(expect.objectContaining({ kind: "missingMarks" }));
  });

  test("a Subject of the Issuing Class with no Assessment in the Term is flagged", async () => {
    const s = await assessmentSchool();

    const { flags } = await cardOf(s, s.class7A.id, s.aisha);
    expect(flags).toContainEqual({ kind: "noAssessments", subject: "Math" });
  });

  test("a missing Subject remark names who owes it, until it's written", async () => {
    const s = await assessmentSchool();
    await marked(s, s.math7A.id, s.aisha, 8);
    const term = await term1(s);
    const wanted = { kind: "missingRemark", subject: "Math", teacher: "Sara" };

    expect((await cardOf(s, s.class7A.id, s.aisha)).flags).toContainEqual(wanted);

    await saveSubjectRemark(s.asSara, { classSubjectId: s.math7A.id, termId: term.id, studentId: s.aisha, remark: "Good." });

    expect((await cardOf(s, s.class7A.id, s.aisha)).flags).not.toContainEqual(wanted);
  });

  test("a missing overall remark names the Class Teacher, until it's written", async () => {
    const s = await assessmentSchool();
    const term = await term1(s);
    const wanted = { kind: "missingOverallRemark", teacher: "Huda" };

    expect((await cardOf(s, s.class7A.id, s.aisha)).flags).toContainEqual(wanted);

    await saveOverallRemark(s.asHuda, { classId: s.class7A.id, termId: term.id, studentId: s.aisha, remark: "Good." });

    expect((await cardOf(s, s.class7A.id, s.aisha)).flags).not.toContainEqual(wanted);
  });

  test("a complete Report Card has no flags, while its classmate's incomplete one does", async () => {
    const s = await assessmentSchool();
    const { id } = await createAssessment(s.asSara, quiz(s.math7A.id));
    await saveMarks(s.asSara, { assessmentId: id, marks: [{ studentId: s.aisha, mark: 8 }] });
    const term = await term1(s);
    await saveSubjectRemark(s.asSara, { classSubjectId: s.math7A.id, termId: term.id, studentId: s.aisha, remark: "Good." });
    await saveOverallRemark(s.asHuda, { classId: s.class7A.id, termId: term.id, studentId: s.aisha, remark: "Good." });

    expect((await cardOf(s, s.class7A.id, s.aisha)).flags).toEqual([]);
    expect((await cardOf(s, s.class7A.id, s.bilal)).flags).toEqual([
      { kind: "missingMarks", subject: "Math", count: 1 },
      { kind: "missingRemark", subject: "Math", teacher: "Sara" },
      { kind: "missingOverallRemark", teacher: "Huda" },
    ]);
  });
});

describe("who can see what", () => {
  test("only the Admin previews a Class's Report Cards", async () => {
    const s = await assessmentSchool();

    await expect(classReportCards(s.asHuda, { classId: s.class7A.id })).rejects.toThrow(AccessDenied);
    await expect(classReportCards(s.asSara, { classId: s.class7A.id })).rejects.toThrow(AccessDenied);
    await expect(classReportCards(s.app.as({ role: "student", userId: s.aisha }), { classId: s.class7A.id })).rejects.toThrow(
      AccessDenied,
    );
  });

  test("a Class that doesn't exist isn't found", async () => {
    const s = await assessmentSchool();

    await expect(classReportCards(s.asAdmin, { classId: 999999 })).rejects.toThrow(NotFound);
    await expect(classReportCards(s.asAdmin, { classId: Number.NaN })).rejects.toThrow(NotFound);
  });

  test("a Class with no Students on the Term's last day has an empty preview", async () => {
    const s = await assessmentSchool();

    expect((await classReportCards(s.asAdmin, { classId: s.class7B.id })).cards).toEqual([]);
  });
});

describe("the Subject Teacher's remark sheet", () => {
  test("it lists the Students whose remark falls to this Class Subject, with their Term Grades and remarks", async () => {
    const s = await assessmentSchool();
    await marked(s, s.math7A.id, s.aisha, 8);
    const term = await term1(s);
    await saveSubjectRemark(s.asSara, { classSubjectId: s.math7A.id, termId: term.id, studentId: s.aisha, remark: "Good." });

    const sheet = await subjectRemarkSheet(s.asSara, { classSubjectId: s.math7A.id });

    expect(sheet).toMatchObject({ subject: "Math", class: "7-A", term: { name: "Term 1" } });
    expect(sheet.rows.map((r) => r.name)).toEqual(["Aisha Rahman", "Bilal Khan"]);
    expect(sheet.rows[0]).toMatchObject({ studentNumber: "S-1", grade: { percent: 80 }, remark: "Good." });
    expect(sheet.rows[1]).toMatchObject({ studentNumber: "S-2", grade: { percent: null }, remark: null });
  });

  test("a moved Student leaves the old Class's sheet for the Issuing Class's, with the whole Term Grade to go on", async () => {
    const s = await assessmentSchool();
    await reassignSubjectTeacher(s.asAdmin, { classSubjectId: s.math7B.id, teacherId: s.omar.userId });
    await marked(s, s.math7A.id, s.aisha, 8);
    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-10-12" });

    const old = await subjectRemarkSheet(s.asSara, { classSubjectId: s.math7A.id });
    expect(old.rows.map((r) => r.name)).toEqual(["Bilal Khan"]);

    // Omar has no Assessment of his own in the figure yet, and still needs it to write the remark.
    const issuing = await subjectRemarkSheet(s.asOmar, { classSubjectId: s.math7B.id });
    expect(issuing.rows.map((r) => r.name)).toEqual(["Aisha Rahman"]);
    expect(issuing.rows[0].grade.percent).toBe(80);
  });

  test("it opens the Term asked for", async () => {
    const s = await assessmentSchool();
    const { terms } = await classReportCards(s.asAdmin, { classId: s.class7A.id });

    const sheet = await subjectRemarkSheet(s.asSara, { classSubjectId: s.math7A.id, termId: terms[1].id });

    expect(sheet.term.name).toBe("Term 2");
    expect(sheet.terms.map((t) => t.name)).toEqual(["Term 1", "Term 2"]);
  });

  test("only the Subject Teacher opens it", async () => {
    const s = await assessmentSchool();
    const input = { classSubjectId: s.math7A.id };

    await expect(subjectRemarkSheet(s.asHuda, input)).rejects.toThrow(AccessDenied);
    await expect(subjectRemarkSheet(s.asOmar, input)).rejects.toThrow(AccessDenied);
    await expect(subjectRemarkSheet(s.asAdmin, input)).rejects.toThrow(AccessDenied);
  });
});

describe("the Class Teacher's remark sheet", () => {
  test("it lists the Issuing Class's Students with every Term Grade, the overall percentage and the remark", async () => {
    const s = await assessmentSchool();
    await marked(s, s.math7A.id, s.aisha, 8);
    const term = await term1(s);
    await saveOverallRemark(s.asHuda, { classId: s.class7A.id, termId: term.id, studentId: s.aisha, remark: "Good." });

    const sheet = await overallRemarkSheet(s.asHuda, { classId: s.class7A.id });

    expect(sheet.class).toBe("7-A");
    expect(sheet.rows.map((r) => r.name)).toEqual(["Aisha Rahman", "Bilal Khan"]);
    expect(sheet.rows[0]).toMatchObject({ overallPercent: 80, overallRemark: "Good." });
    expect(sheet.rows[0].grades.map((g) => [g.subject, g.percent])).toEqual([["Math", 80]]);
  });

  test("a Student who moved away isn't on the old Class's sheet, and a Subject from their old Class shows on the new one", async () => {
    const s = await assessmentSchool();
    const history7A = await createClassSubject(s.asAdmin, {
      classId: s.class7A.id,
      subjectId: (await createSubject(s.asAdmin, { name: "History" })).id,
      teacherId: s.sara.userId,
    });
    await marked(s, history7A.id, s.aisha, 9);
    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-10-12" });

    expect((await overallRemarkSheet(s.asHuda, { classId: s.class7A.id })).rows.map((r) => r.name)).toEqual(["Bilal Khan"]);

    const [aisha] = (await overallRemarkSheet(s.asOmar, { classId: s.class7B.id })).rows;
    expect(aisha.name).toBe("Aisha Rahman");
    expect(aisha.grades.find((g) => g.subject === "History")?.percent).toBe(90);
  });

  test("only the Class Teacher opens it", async () => {
    const s = await assessmentSchool();
    const input = { classId: s.class7A.id };

    await expect(overallRemarkSheet(s.asSara, input)).rejects.toThrow(AccessDenied);
    await expect(overallRemarkSheet(s.asOmar, input)).rejects.toThrow(AccessDenied);
    await expect(overallRemarkSheet(s.asAdmin, input)).rejects.toThrow(AccessDenied);
  });
});

describe("a Student with no Issuing Class", () => {
  test("a Leaving Student gone before the Term's last day has no Report Card, and the preview says so", async () => {
    const s = await yearEndSchool();
    await marked(s, s.math7A.id, s.aisha, 8);
    await promoteClass(s.asAdmin, {
      classId: s.class7A.id,
      toClassId: s.class8A.id,
      leaving: [{ studentId: s.aisha, lastDay: "2026-10-01" }],
    });

    const preview = await classReportCards(s.asAdmin, { classId: s.class7A.id });

    expect(preview.cards.map((c) => c.name)).toEqual(["Bilal Khan"]);
    expect(preview.noReportCard).toEqual([
      { studentId: s.aisha, name: "Aisha Rahman", studentNumber: "S-1", lastDay: "2026-10-01" },
    ]);
  });

  test("they aren't ranked, and the Students who stayed rank without them", async () => {
    const s = await yearEndSchool();
    const { id } = await createAssessment(s.asSara, quiz(s.math7A.id));
    await saveMarks(s.asSara, {
      assessmentId: id,
      marks: [
        { studentId: s.aisha, mark: 10 },
        { studentId: s.bilal, mark: 5 },
      ],
    });
    await promoteClass(s.asAdmin, {
      classId: s.class7A.id,
      toClassId: s.class8A.id,
      leaving: [{ studentId: s.aisha, lastDay: "2026-10-01" }],
    });
    await setRankEnabled(s.asAdmin, true);

    const { cards } = await classReportCards(s.asAdmin, { classId: s.class7A.id });

    expect(cards.map((c) => [c.name, c.rank])).toEqual([["Bilal Khan", 1]]);
  });

  test("no one can write their remarks", async () => {
    const s = await yearEndSchool();
    await marked(s, s.math7A.id, s.aisha, 8);
    const { term } = await classReportCards(s.asAdmin, { classId: s.class7A.id });
    await promoteClass(s.asAdmin, {
      classId: s.class7A.id,
      toClassId: s.class8A.id,
      leaving: [{ studentId: s.aisha, lastDay: "2026-10-01" }],
    });

    await expect(
      saveSubjectRemark(s.asSara, { classSubjectId: s.math7A.id, termId: term.id, studentId: s.aisha, remark: "No." }),
    ).rejects.toThrow(AccessDenied);
    await expect(
      saveOverallRemark(s.asHuda, { classId: s.class7A.id, termId: term.id, studentId: s.aisha, remark: "No." }),
    ).rejects.toThrow(AccessDenied);
    expect((await subjectRemarkSheet(s.asSara, { classSubjectId: s.math7A.id })).rows.map((r) => r.name)).toEqual([
      "Bilal Khan",
    ]);
  });

  test("their Term Grades stay visible on their own record", async () => {
    const s = await yearEndSchool();
    await marked(s, s.math7A.id, s.aisha, 8);
    await promoteClass(s.asAdmin, {
      classId: s.class7A.id,
      toClassId: s.class8A.id,
      leaving: [{ studentId: s.aisha, lastDay: "2026-10-01" }],
    });

    const [term] = await studentTermGrades(s.asAdmin, { studentId: s.aisha });

    expect(term.issuingClass).toBeNull();
    expect(term.grades[0].percent).toBe(80);
  });

  test("they're listed once, on the last Class they were in during the Term", async () => {
    const s = await yearEndSchool();
    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-09-20" });
    await promoteClass(s.asAdmin, {
      classId: s.class7B.id,
      leaving: [{ studentId: s.aisha, lastDay: "2026-10-01" }],
    });

    const a = await classReportCards(s.asAdmin, { classId: s.class7A.id });
    const b = await classReportCards(s.asAdmin, { classId: s.class7B.id });

    expect(a.noReportCard).toEqual([]);
    expect(b.noReportCard.map((n) => n.name)).toEqual(["Aisha Rahman"]);
  });

  test("a Term they weren't in at all doesn't mention them", async () => {
    const s = await yearEndSchool();
    const { terms } = await classReportCards(s.asAdmin, { classId: s.class7A.id });
    await promoteClass(s.asAdmin, {
      classId: s.class7A.id,
      toClassId: s.class8A.id,
      leaving: [{ studentId: s.aisha, lastDay: "2026-10-01" }],
    });

    const term2 = await classReportCards(s.asAdmin, { classId: s.class7A.id, termId: terms[1].id });

    expect(term2.noReportCard).toEqual([]);
    expect(term2.cards.map((c) => c.name)).toEqual(["Bilal Khan"]);
  });

  test("a Student who moved to another Class is that Class's card, not on the no-card list", async () => {
    const s = await yearEndSchool();
    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-10-12" });

    expect((await classReportCards(s.asAdmin, { classId: s.class7A.id })).noReportCard).toEqual([]);
  });
});

describe("remarks and Terms", () => {
  test("remarks survive the Admin editing the Academic Year, which replaces its Terms", async () => {
    const s = await assessmentSchool();
    await marked(s, s.math7A.id, s.aisha, 8);
    const before = await term1(s);
    await saveSubjectRemark(s.asSara, {
      classSubjectId: s.math7A.id,
      termId: before.id,
      studentId: s.aisha,
      remark: "Still here.",
    });
    await saveOverallRemark(s.asHuda, { classId: s.class7A.id, termId: before.id, studentId: s.aisha, remark: "Me too." });

    await updateAcademicYear(s.asAdmin, {
      id: s.year.id,
      name: "2026-2027",
      startDate: "2026-09-01",
      endDate: "2027-06-30",
      terms: [
        { name: "Autumn", startDate: "2026-09-01", endDate: "2026-12-31" },
        { name: "Spring", startDate: "2027-01-01", endDate: "2027-06-30" },
      ],
    });

    const card = await cardOf(s, s.class7A.id, s.aisha);
    expect(card.overallRemark).toBe("Me too.");
    expect(card.grades[0].remark).toBe("Still here.");
  });

  test("a Term's remarks stay on that Term, and never show on another", async () => {
    const s = await assessmentSchool();
    const { terms } = await classReportCards(s.asAdmin, { classId: s.class7A.id });
    await saveOverallRemark(s.asHuda, { classId: s.class7A.id, termId: terms[0].id, studentId: s.aisha, remark: "Term 1." });

    const term2 = await classReportCards(s.asAdmin, { classId: s.class7A.id, termId: terms[1].id });
    expect(term2.term.name).toBe("Term 2");
    expect(term2.cards.find((c) => c.studentId === s.aisha)?.overallRemark).toBeNull();
  });

  test("moving a Term's last day leaves its remarks out rather than filing them under the wrong Term", async () => {
    const s = await assessmentSchool();
    const { terms } = await classReportCards(s.asAdmin, { classId: s.class7A.id });
    await saveOverallRemark(s.asHuda, { classId: s.class7A.id, termId: terms[0].id, studentId: s.aisha, remark: "Term 1." });

    await updateAcademicYear(s.asAdmin, {
      id: s.year.id,
      name: "2026-2027",
      startDate: "2026-09-01",
      endDate: "2027-06-30",
      terms: [
        { name: "Term 1", startDate: "2026-09-01", endDate: "2026-12-20" },
        { name: "Term 2", startDate: "2026-12-21", endDate: "2027-06-30" },
      ],
    });

    const after = await classReportCards(s.asAdmin, { classId: s.class7A.id });
    for (const term of after.terms) {
      const { cards } = await classReportCards(s.asAdmin, { classId: s.class7A.id, termId: term.id });
      expect(cards.find((c) => c.studentId === s.aisha)?.overallRemark).toBeNull();
    }
  });
});

import { describe, expect, test } from "vitest";
import { createAssessment, updateAssessment } from "../assessments/assessments";
import { type MarkValue, saveMarks } from "../assessments/marks";
import { assessmentSchool, quiz } from "../assessments/test-assessments";
import { createClassSubject, reassignSubjectTeacher } from "../classes/class-subjects";
import { createClass } from "../classes/classes";
import { enrollStudent, moveStudent } from "../enrollment/enrollment";
import { AccessDenied, NotFound } from "../errors";
import { createAcademicYear, listAcademicYears } from "../school/academic-year";
import { createGrade, createSubject } from "../school/catalogue";
import { registerStudent } from "../students/register-student";
import { setGradingScale } from "./grading-scales";
import { classSubjectTermGrades, studentTermGrades } from "./term-grades";

const letters = {
  passMark: 50,
  bands: [
    { minPercent: 80, label: "A" },
    { minPercent: 50, label: "B" },
    { minPercent: 0, label: "F" },
  ],
};

type School = Awaited<ReturnType<typeof assessmentSchool>>;

/** Sara creates an Assessment in her Class Subject and enters one Student's Mark. */
async function marked(
  s: School,
  classSubjectId: number,
  studentId: string,
  value: MarkValue,
  over: Parameters<typeof quiz>[1] = {},
  teacher = s.asSara,
) {
  const { id } = await createAssessment(teacher, quiz(classSubjectId, over));
  await saveMarks(teacher, { assessmentId: id, marks: [{ studentId, mark: value }] });
  return id;
}

/** The one Term's only Subject in a Student's Term Grades. */
async function onlyGrade(s: School, studentId: string) {
  const terms = await studentTermGrades(s.asAdmin, { studentId });
  expect(terms).toHaveLength(1);
  expect(terms[0].grades).toHaveLength(1);
  return terms[0].grades[0];
}

describe("working out a Term Grade", () => {
  test("a Term Grade is the weighted average of the Term's Assessments in the Subject", async () => {
    const s = await assessmentSchool();
    await marked(s, s.math7A.id, s.aisha, 8, { maxMarks: 10, weight: 1 });
    await marked(s, s.math7A.id, s.aisha, 20, { maxMarks: 50, weight: 3 });

    // (1 × 8/10 + 3 × 20/50) ÷ (1 + 3) = 2 ÷ 4 = 50%
    expect((await onlyGrade(s, s.aisha)).percent).toBe(50);
  });

  test("weights don't have to add up to 100", async () => {
    const s = await assessmentSchool();
    await marked(s, s.math7A.id, s.aisha, 8, { maxMarks: 10, weight: 10 });
    await marked(s, s.math7A.id, s.aisha, 20, { maxMarks: 50, weight: 30 });

    expect((await onlyGrade(s, s.aisha)).percent).toBe(50);
  });

  test("an Exempt Mark is left out, along with its weight", async () => {
    const s = await assessmentSchool();
    await marked(s, s.math7A.id, s.aisha, 8, { maxMarks: 10, weight: 1 });
    await marked(s, s.math7A.id, s.aisha, "exempt", { maxMarks: 50, weight: 3 });

    const grade = await onlyGrade(s, s.aisha);
    expect(grade.percent).toBe(80);
    expect(grade).toMatchObject({ counted: 1, exempt: 1, missing: 0 });
  });

  test("an Absent Mark counts as 0, and its weight stays", async () => {
    const s = await assessmentSchool();
    await marked(s, s.math7A.id, s.aisha, 8, { maxMarks: 10, weight: 1 });
    await marked(s, s.math7A.id, s.aisha, "absent", { maxMarks: 50, weight: 3 });

    // (1 × 8/10 + 3 × 0) ÷ 4 = 20%
    const grade = await onlyGrade(s, s.aisha);
    expect(grade.percent).toBe(20);
    expect(grade).toMatchObject({ counted: 2, exempt: 0, missing: 0 });
  });

  test("an Assessment with no Mark yet doesn't count, and shows as missing", async () => {
    const s = await assessmentSchool();
    await marked(s, s.math7A.id, s.aisha, 8, { maxMarks: 10, weight: 1 });
    await createAssessment(s.asSara, quiz(s.math7A.id, { maxMarks: 50, weight: 3 }));

    const grade = await onlyGrade(s, s.aisha);
    expect(grade.percent).toBe(80);
    expect(grade).toMatchObject({ counted: 1, exempt: 0, missing: 1 });
  });

  test("a Student who is Exempt from everything has no Term Grade percentage, label or result", async () => {
    const s = await assessmentSchool();
    await setGradingScale(s.asAdmin, { gradeId: s.grade7.id, ...letters });
    await marked(s, s.math7A.id, s.aisha, "exempt");

    expect(await onlyGrade(s, s.aisha)).toMatchObject({ percent: null, label: null, passed: null, exempt: 1 });
  });

  test("the percentage is rounded to two decimals", async () => {
    const s = await assessmentSchool();
    await marked(s, s.math7A.id, s.aisha, 2, { maxMarks: 3 });

    expect((await onlyGrade(s, s.aisha)).percent).toBe(66.67);
  });

  test("changing an Assessment's maximum or weight after Marks are entered recalculates the Term Grade", async () => {
    const s = await assessmentSchool();
    await marked(s, s.math7A.id, s.aisha, 8, { maxMarks: 10, weight: 1 });
    const second = await marked(s, s.math7A.id, s.aisha, 20, { maxMarks: 50, weight: 3 });
    await updateAssessment(s.asSara, { assessmentId: second, maxMarks: 25, weight: 1 });

    // (1 × 8/10 + 1 × 20/25) ÷ 2 = 80%
    expect((await onlyGrade(s, s.aisha)).percent).toBe(80);
  });

  test("each Subject has its own Term Grade, and another Student's Marks stay out of it", async () => {
    const s = await assessmentSchool();
    const science7A = await createClassSubject(s.asAdmin, {
      classId: s.class7A.id,
      subjectId: s.science.id,
      teacherId: s.omar.userId,
    });
    await marked(s, s.math7A.id, s.aisha, 9);
    await marked(s, science7A.id, s.aisha, 3, {}, s.asOmar);
    await marked(s, s.math7A.id, s.bilal, 1);

    const [term] = await studentTermGrades(s.asAdmin, { studentId: s.aisha });
    expect(term.grades.map((g) => [g.subject, g.percent])).toEqual([
      ["Math", 90],
      ["Science", 30],
    ]);
  });

  test("Assessments fall into the Term their date is in, newest Term first", async () => {
    const s = await assessmentSchool();
    await marked(s, s.math7A.id, s.aisha, 9, { date: "2026-12-31" });
    await marked(s, s.math7A.id, s.aisha, 5, { date: "2027-01-01" });

    const terms = await studentTermGrades(s.asAdmin, { studentId: s.aisha });
    expect(terms.map((t) => [t.term.name, t.grades[0].percent])).toEqual([
      ["Term 2", 50],
      ["Term 1", 90],
    ]);
  });

  test("a Student with no Assessments has no Term Grades", async () => {
    const s = await assessmentSchool();
    expect(await studentTermGrades(s.asAdmin, { studentId: s.aisha })).toEqual([]);
  });
});

describe("the Aisha scenario: moving Class mid-Term", () => {
  test("both Classes' Marks count towards the Subject's Term Grade, and 7-B is her Issuing Class", async () => {
    const s = await assessmentSchool();
    await marked(s, s.math7A.id, s.aisha, 8, { date: "2026-09-20" });
    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-10-12" });
    await marked(s, s.math7B.id, s.aisha, 4, { date: "2026-10-15" });

    // (8/10 + 4/10) ÷ 2 = 60%
    const [term] = await studentTermGrades(s.asAdmin, { studentId: s.aisha });
    expect(term.issuingClass?.name).toBe("7-B");
    expect(term.grades.map((g) => [g.subject, g.percent, g.counted])).toEqual([["Math", 60, 2]]);
  });

  test("her classmate who stayed in 7-A isn't affected by 7-B's Assessments", async () => {
    const s = await assessmentSchool();
    await marked(s, s.math7A.id, s.bilal, 8, { date: "2026-09-20" });
    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-10-12" });
    await marked(s, s.math7B.id, s.aisha, 4, { date: "2026-10-15" });

    expect((await onlyGrade(s, s.bilal)).percent).toBe(80);
  });

  test("an Assessment in a Class she wasn't in on its date doesn't count, even as missing", async () => {
    const s = await assessmentSchool();
    await marked(s, s.math7A.id, s.aisha, 8, { date: "2026-09-20" });
    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-10-12" });
    await createAssessment(s.asSara, quiz(s.math7A.id, { date: "2026-10-13" })); // 7-A, after she left
    await createAssessment(s.asSara, quiz(s.math7B.id, { date: "2026-10-11" })); // 7-B, before she came

    expect(await onlyGrade(s, s.aisha)).toMatchObject({ percent: 80, counted: 1, missing: 0 });
  });

  test("a Mark left behind by a backdated move doesn't count", async () => {
    const s = await assessmentSchool();
    await marked(s, s.math7A.id, s.aisha, 8, { date: "2026-09-20" });
    await marked(s, s.math7A.id, s.aisha, 2, { date: "2026-10-01" });
    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-09-25" });

    expect(await onlyGrade(s, s.aisha)).toMatchObject({ percent: 80, counted: 1 });
  });

  test("moving back into the first Class counts every Assessment once", async () => {
    const s = await assessmentSchool();
    await marked(s, s.math7A.id, s.aisha, 8, { date: "2026-09-20" });
    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-10-01" });
    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7A.id, date: "2026-10-10" });
    await marked(s, s.math7A.id, s.aisha, 4, { date: "2026-10-15" });

    const [term] = await studentTermGrades(s.asAdmin, { studentId: s.aisha });
    expect(term.issuingClass?.name).toBe("7-A");
    expect(term.grades[0]).toMatchObject({ percent: 60, counted: 2 });
  });

  test("the Issuing Class is the Class on each Term's last day", async () => {
    const s = await assessmentSchool();
    await marked(s, s.math7A.id, s.aisha, 8, { date: "2026-09-20" });
    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2027-02-01" });
    await marked(s, s.math7A.id, s.aisha, 8, { date: "2027-01-15" });
    await marked(s, s.math7B.id, s.aisha, 8, { date: "2027-03-01" });

    const terms = await studentTermGrades(s.asAdmin, { studentId: s.aisha });
    expect(terms.map((t) => [t.term.name, t.issuingClass?.name])).toEqual([
      ["Term 2", "7-B"],
      ["Term 1", "7-A"],
    ]);
  });

  test("moving on a Term's very last day makes the new Class the Issuing Class", async () => {
    const s = await assessmentSchool();
    await marked(s, s.math7A.id, s.aisha, 8, { date: "2026-09-20" });
    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-12-31" });

    const [term] = await studentTermGrades(s.asAdmin, { studentId: s.aisha });
    expect(term.issuingClass?.name).toBe("7-B");
  });
});

describe("label and pass or fail", () => {
  test.each([
    [8, "A", true], // exactly on a band's start
    [7.99, "B", true],
    [5, "B", true], // exactly on the pass mark
    [4.99, "F", false],
    [0, "F", false],
  ])("%d out of 10 reads as %s on the Grading Scale", async (score, label, passed) => {
    const s = await assessmentSchool();
    await setGradingScale(s.asAdmin, { gradeId: s.grade7.id, ...letters });
    await marked(s, s.math7A.id, s.aisha, score, { maxMarks: 10 });

    expect(await onlyGrade(s, s.aisha)).toMatchObject({ label, passed });
  });

  test("the pass mark doesn't have to be a band's start", async () => {
    const s = await assessmentSchool();
    await setGradingScale(s.asAdmin, { gradeId: s.grade7.id, ...letters, passMark: 60 });
    await marked(s, s.math7A.id, s.aisha, 5, { maxMarks: 10 });

    expect(await onlyGrade(s, s.aisha)).toMatchObject({ label: "B", passed: false });
  });

  test("the label and result follow the percentage as shown, after rounding", async () => {
    const s = await assessmentSchool();
    await setGradingScale(s.asAdmin, { gradeId: s.grade7.id, ...letters });
    await marked(s, s.math7A.id, s.aisha, 2399.99, { maxMarks: 3000 }); // 79.9997% shows as 80%

    expect(await onlyGrade(s, s.aisha)).toMatchObject({ percent: 80, label: "A" });
  });

  test("a Grade with no Grading Scale still shows the percentage, with no label or result", async () => {
    const s = await assessmentSchool();
    await marked(s, s.math7A.id, s.aisha, 8);

    expect(await onlyGrade(s, s.aisha)).toMatchObject({ percent: 80, label: null, passed: null });
  });

  test("Students in different Grades read the same percentage on their own Grade's Grading Scale", async () => {
    const s = await assessmentSchool();
    const grade8 = await createGrade(s.asAdmin, { name: "Grade 8" });
    const class8A = await createClass(s.asAdmin, {
      academicYearId: s.year.id,
      gradeId: grade8.id,
      name: "8-A",
      classTeacherId: s.omar.userId,
    });
    const math8A = await createClassSubject(s.asAdmin, {
      classId: class8A.id,
      subjectId: s.math.id,
      teacherId: s.sara.userId,
    });
    const { studentId: carim } = await registerStudent(s.asAdmin, {
      name: "Carim Saleh",
      studentNumber: "S-3",
      dateOfBirth: "2012-04-12",
      nationalId: "784-S-3",
      guardianContact: "Guardian",
      admissionDate: "2026-08-25",
    });
    await enrollStudent(s.asAdmin, { studentId: carim, classId: class8A.id, startDate: "2026-09-01" });
    await setGradingScale(s.asAdmin, { gradeId: s.grade7.id, ...letters });
    await setGradingScale(s.asAdmin, {
      gradeId: grade8.id,
      passMark: 70,
      bands: [
        { minPercent: 70, label: "Merit" },
        { minPercent: 0, label: "Below" },
      ],
    });
    await marked(s, s.math7A.id, s.aisha, 6);
    await marked(s, math8A.id, carim, 6);

    expect(await onlyGrade(s, s.aisha)).toMatchObject({ percent: 60, label: "B", passed: true });
    expect(await onlyGrade(s, carim)).toMatchObject({ percent: 60, label: "Below", passed: false });
  });

  test("a mid-Term move reads the Term Grade on the Issuing Class's Grade's Grading Scale", async () => {
    const s = await assessmentSchool();
    await setGradingScale(s.asAdmin, { gradeId: s.grade7.id, ...letters });
    await marked(s, s.math7A.id, s.aisha, 8, { date: "2026-09-20" });
    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-10-12" });

    const [term] = await studentTermGrades(s.asAdmin, { studentId: s.aisha });
    expect(term.issuingClass).toMatchObject({ name: "7-B", grade: "Grade 7" });
    expect(term.grades[0]).toMatchObject({ label: "A", passed: true });
  });

  test("changing the Grading Scale changes the label straight away", async () => {
    const s = await assessmentSchool();
    await setGradingScale(s.asAdmin, { gradeId: s.grade7.id, ...letters });
    await marked(s, s.math7A.id, s.aisha, 8);
    await setGradingScale(s.asAdmin, {
      gradeId: s.grade7.id,
      passMark: 90,
      bands: [{ minPercent: 0, label: "Reviewed" }],
    });

    expect(await onlyGrade(s, s.aisha)).toMatchObject({ label: "Reviewed", passed: false });
  });
});

describe("who can see a Student's Term Grades", () => {
  test("a Student sees their own Term Grades, but not a classmate's", async () => {
    const s = await assessmentSchool();
    await marked(s, s.math7A.id, s.aisha, 8);
    const asAisha = s.app.as({ role: "student", userId: s.aisha });

    const [term] = await studentTermGrades(asAisha, { studentId: s.aisha });
    expect(term.grades[0].percent).toBe(80);
    await expect(studentTermGrades(asAisha, { studentId: s.bilal })).rejects.toThrow(AccessDenied);
  });

  test("a Teacher who never taught the Student is refused", async () => {
    const s = await assessmentSchool();
    await marked(s, s.math7A.id, s.aisha, 8);

    await expect(studentTermGrades(s.asOmar, { studentId: s.aisha })).rejects.toThrow(AccessDenied);
  });

  test("a Subject Teacher sees only their own Subject's Term Grade; the Class Teacher sees every Subject", async () => {
    const s = await assessmentSchool();
    const science7A = await createClassSubject(s.asAdmin, {
      classId: s.class7A.id,
      subjectId: s.science.id,
      teacherId: s.omar.userId,
    });
    await marked(s, s.math7A.id, s.aisha, 9);
    await marked(s, science7A.id, s.aisha, 3, {}, s.asOmar);

    const subjects = async (ctx: School["asAdmin"]) =>
      (await studentTermGrades(ctx, { studentId: s.aisha })).flatMap((t) => t.grades.map((g) => g.subject));
    expect(await subjects(s.asSara)).toEqual(["Math"]);
    expect(await subjects(s.asOmar)).toEqual(["Science"]);
    expect(await subjects(s.asHuda)).toEqual(["Math", "Science"]);
    expect(await subjects(s.asAdmin)).toEqual(["Math", "Science"]);
  });

  test("after Aisha moves, her old Subject Teacher still sees the whole Term Grade in that Subject", async () => {
    const s = await assessmentSchool();
    await reassignSubjectTeacher(s.asAdmin, { classSubjectId: s.math7B.id, teacherId: s.omar.userId });
    await marked(s, s.math7A.id, s.aisha, 8, { date: "2026-09-20" });
    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-10-12" });
    await marked(s, s.math7B.id, s.aisha, 4, { date: "2026-10-15" }, s.asOmar);

    const [term] = await studentTermGrades(s.asSara, { studentId: s.aisha });
    expect(term.grades.map((g) => [g.subject, g.percent])).toEqual([["Math", 60]]);
  });

  test("the Issuing Class's Class Teacher sees a Subject their Class doesn't have, from her old Class", async () => {
    const s = await assessmentSchool();
    const art = await createSubject(s.asAdmin, { name: "Art" });
    const art7A = await createClassSubject(s.asAdmin, {
      classId: s.class7A.id,
      subjectId: art.id,
      teacherId: s.sara.userId,
    });
    await marked(s, art7A.id, s.aisha, 7, { date: "2026-09-20" });
    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-10-12" });

    const [term] = await studentTermGrades(s.asOmar, { studentId: s.aisha });
    expect(term.grades.map((g) => [g.subject, g.percent])).toEqual([["Art", 70]]);
  });

  test("a Teacher sees no Term in which nothing of theirs counted", async () => {
    const s = await assessmentSchool();
    await reassignSubjectTeacher(s.asAdmin, { classSubjectId: s.math7B.id, teacherId: s.omar.userId });
    await marked(s, s.math7A.id, s.aisha, 8, { date: "2026-09-20" });
    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2027-01-05" });
    await marked(s, s.math7B.id, s.aisha, 4, { date: "2027-02-01" }, s.asOmar);

    const terms = await studentTermGrades(s.asSara, { studentId: s.aisha });
    expect(terms.map((t) => t.term.name)).toEqual(["Term 1"]);
  });
});

describe("a Class Subject's Term Grades", () => {
  test("lists every Student in the Class during the Term, with their Term Grade in that Subject", async () => {
    const s = await assessmentSchool();
    await setGradingScale(s.asAdmin, { gradeId: s.grade7.id, ...letters });
    await marked(s, s.math7A.id, s.aisha, 8, { date: "2026-09-20" });
    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-10-12" });
    await marked(s, s.math7B.id, s.aisha, 4, { date: "2026-10-15" });

    const page = await classSubjectTermGrades(s.asSara, { classSubjectId: s.math7A.id });
    expect(page.term?.name).toBe("Term 1");
    expect(page.rows.map((r) => [r.name, r.issuingClass, r.grade.percent, r.grade.label])).toEqual([
      ["Aisha Rahman", "7-B", 60, "B"],
      ["Bilal Khan", "7-A", null, null],
    ]);
    expect(page.rows[1].grade).toMatchObject({ counted: 0, missing: 1 });
  });

  test("the same Student reads the same Term Grade from either Class", async () => {
    const s = await assessmentSchool();
    await marked(s, s.math7A.id, s.aisha, 8, { date: "2026-09-20" });
    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-10-12" });
    await marked(s, s.math7B.id, s.aisha, 4, { date: "2026-10-15" });

    const page = await classSubjectTermGrades(s.asSara, { classSubjectId: s.math7B.id });
    expect(page.rows.map((r) => [r.name, r.grade.percent])).toEqual([["Aisha Rahman", 60]]);
  });

  test("opens on today's Term, and any Term of the Class's year can be chosen", async () => {
    const s = await assessmentSchool();
    await marked(s, s.math7A.id, s.aisha, 8, { date: "2026-09-20" });
    await marked(s, s.math7A.id, s.aisha, 3, { date: "2027-01-20" });

    const first = await classSubjectTermGrades(s.asSara, { classSubjectId: s.math7A.id });
    expect(first.term?.name).toBe("Term 1");
    expect(first.terms.map((t) => t.name)).toEqual(["Term 1", "Term 2"]);

    const term2 = first.terms[1];
    const second = await classSubjectTermGrades(s.asSara, { classSubjectId: s.math7A.id, termId: term2.id });
    expect(second.term?.name).toBe("Term 2");
    expect(second.rows[0].grade.percent).toBe(30);
  });

  test("outside the Class's year it opens on the year's first Term", async () => {
    const s = await assessmentSchool();
    s.app.clock.set("2030-01-01T08:00:00+04:00");

    const page = await classSubjectTermGrades(s.asSara, { classSubjectId: s.math7A.id });
    expect(page.term?.name).toBe("Term 1");
  });

  test("a Term of another Academic Year names nothing here", async () => {
    const s = await assessmentSchool();
    await createAcademicYear(s.asAdmin, {
      name: "2027-2028",
      startDate: "2027-09-01",
      endDate: "2028-06-30",
      terms: [{ name: "Only", startDate: "2027-09-01", endDate: "2028-06-30" }],
    });
    const years = await listAcademicYears(s.asAdmin);
    const foreign = years.find((y) => y.name === "2027-2028")!.terms[0].id;

    await expect(classSubjectTermGrades(s.asSara, { classSubjectId: s.math7A.id, termId: foreign })).rejects.toThrow(
      NotFound,
    );
    await expect(
      classSubjectTermGrades(s.asSara, { classSubjectId: s.math7A.id, termId: Number.NaN }),
    ).rejects.toThrow(NotFound);
  });

  test("its Subject Teacher, its Class Teacher and the Admin can see it; others are refused", async () => {
    const s = await assessmentSchool();
    const input = { classSubjectId: s.math7A.id };

    await expect(classSubjectTermGrades(s.asSara, input)).resolves.toBeDefined();
    await expect(classSubjectTermGrades(s.asHuda, input)).resolves.toBeDefined();
    await expect(classSubjectTermGrades(s.asAdmin, input)).resolves.toBeDefined();
    await expect(classSubjectTermGrades(s.asOmar, input)).rejects.toThrow(AccessDenied);
    await expect(classSubjectTermGrades(s.app.as({ role: "student", userId: s.aisha }), input)).rejects.toThrow(
      AccessDenied,
    );
  });
});

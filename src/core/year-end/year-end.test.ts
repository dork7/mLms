import { describe, expect, it, test } from "vitest";
import { createAssessment, updateAssessment } from "../assessments/assessments";
import { marksGrid, saveMarks, studentAssessmentHistory } from "../assessments/marks";
import { quiz } from "../assessments/test-assessments";
import { createClassSubject, listClassSubjects, reassignSubjectTeacher } from "../classes/class-subjects";
import { createClass, getClass } from "../classes/classes";
import { classRoster, enrollStudent } from "../enrollment/enrollment";
import { AcademicYearClosed, AccessDenied, InvalidInput, NotFound, PromotionNotDone } from "../errors";
import { addExam, examTimetable } from "../exams/exams";
import { getGradingScale, setGradingScale } from "../grading/grading-scales";
import { classSubjectTermGrades, studentTermGrades } from "../grading/term-grades";
import { lessonFormDefaults, listClassLessons, logLesson } from "../lessons/lessons";
import { listAcademicYears, updateAcademicYear } from "../school/academic-year";
import { createGrade, createRoom, setGradeOrder } from "../school/catalogue";
import { requireOpenYear } from "../school/closed-year";
import { setPeriodsPerDay } from "../school/periods";
import { publishReportCards, studentReportCards, unpublishReportCards } from "../report-cards/publish";
import { overallRemarkSheet, saveOverallRemark, saveSubjectRemark, subjectRemarkSheet } from "../report-cards/remarks";
import { classReportCards } from "../report-cards/report-cards";
import { getStudentProfile } from "../students/student-profile";
import { yearEndSchool } from "./test-year-end";
import { closeAcademicYear, promoteClass, promotionForm, yearEndOverview } from "./year-end";

type School = Awaited<ReturnType<typeof yearEndSchool>>;

const rosterNames = async (s: School, classId: number, date: string) =>
  (await classRoster(s.asAdmin, { classId, date })).map((r) => r.name);

const refusal = (key: string) => expect.objectContaining({ name: "InvalidInput", messageKey: key });

/** The fixture's whole year rolled over: 7-A into 8-A, and 7-A is the only Class with Students. */
const promoteAndClose = async (s: School) => {
  await promoteClass(s.asAdmin, { classId: s.class7A.id, toClassId: s.class8A.id });
  await closeAcademicYear(s.asAdmin, { academicYearId: s.year.id });
};

describe("Promotion", () => {
  it("the Admin promotes a whole Class into a Class of the next Grade in the new Academic Year", async () => {
    const s = await yearEndSchool();

    await promoteClass(s.asAdmin, { classId: s.class7A.id, toClassId: s.class8A.id });

    expect(await rosterNames(s, s.class8A.id, "2027-09-01")).toEqual(["Aisha Rahman", "Bilal Khan"]);
    // They stay on the old roster up to the old year's last day, and no further.
    expect(await rosterNames(s, s.class7A.id, "2027-06-30")).toEqual(["Aisha Rahman", "Bilal Khan"]);
    expect(await rosterNames(s, s.class7A.id, "2027-07-01")).toEqual([]);
    expect((await getStudentProfile(s.asAdmin, { studentId: s.aisha })).enrollments).toMatchObject([
      { class: "7-A", startDate: "2026-09-01", endDate: "2027-06-30" },
      { class: "8-A", grade: "Grade 8", academicYear: "2027-2028", startDate: "2027-09-01", endDate: null },
    ]);
  });

  it("a Repeating Student gets an Enrollment in the same Grade in the new year, not the promoted Class", async () => {
    const s = await yearEndSchool();

    await promoteClass(s.asAdmin, {
      classId: s.class7A.id,
      toClassId: s.class8A.id,
      repeating: [{ studentId: s.bilal, classId: s.next7A.id }],
    });

    expect(await rosterNames(s, s.class8A.id, "2027-09-01")).toEqual(["Aisha Rahman"]);
    expect(await rosterNames(s, s.next7A.id, "2027-09-01")).toEqual(["Bilal Khan"]);
  });

  it("a Leaving Student's Enrollment ends on the year's last day and no new one is created", async () => {
    const s = await yearEndSchool();

    await promoteClass(s.asAdmin, {
      classId: s.class7A.id,
      toClassId: s.class8A.id,
      leaving: [{ studentId: s.bilal }],
    });

    expect(await rosterNames(s, s.class8A.id, "2027-09-01")).toEqual(["Aisha Rahman"]);
    expect((await getStudentProfile(s.asAdmin, { studentId: s.bilal })).enrollments).toMatchObject([
      { class: "7-A", startDate: "2026-09-01", endDate: "2027-06-30" },
    ]);
  });

  it("a Student who already left earlier in the year can be given their own last day", async () => {
    const s = await yearEndSchool();

    await promoteClass(s.asAdmin, {
      classId: s.class7A.id,
      toClassId: s.class8A.id,
      leaving: [{ studentId: s.bilal, lastDay: "2027-03-15" }],
    });

    expect(await rosterNames(s, s.class7A.id, "2027-03-15")).toEqual(["Aisha Rahman", "Bilal Khan"]);
    expect(await rosterNames(s, s.class7A.id, "2027-03-16")).toEqual(["Aisha Rahman"]);
  });

  it("a final-Grade Class needs no target when every Student is Leaving", async () => {
    const s = await yearEndSchool();

    await promoteClass(s.asAdmin, {
      classId: s.class7A.id,
      leaving: [{ studentId: s.aisha }, { studentId: s.bilal }],
    });

    expect(await rosterNames(s, s.class7A.id, "2027-07-01")).toEqual([]);
  });

  it("a Student who already moved out of the Class isn't promoted with it", async () => {
    const s = await yearEndSchool();
    await promoteClass(s.asAdmin, {
      classId: s.class7A.id,
      toClassId: s.class8A.id,
      leaving: [{ studentId: s.bilal, lastDay: "2026-10-01" }],
    });
    await enrollStudent(s.asAdmin, { studentId: s.bilal, classId: s.class7B.id, startDate: "2026-10-02" });

    await promoteClass(s.asAdmin, { classId: s.class7B.id, toClassId: s.class8B.id });

    expect(await rosterNames(s, s.class8A.id, "2027-09-01")).toEqual(["Aisha Rahman"]);
    expect(await rosterNames(s, s.class8B.id, "2027-09-01")).toEqual(["Bilal Khan"]);
  });

  describe("what the Admin is refused", () => {
    test("a Teacher can't promote a Class", async () => {
      const s = await yearEndSchool();
      await expect(
        promoteClass(s.app.as(s.huda), { classId: s.class7A.id, toClassId: s.class8A.id }),
      ).rejects.toThrow(AccessDenied);
    });

    test("an unknown Class", async () => {
      const s = await yearEndSchool();
      await expect(promoteClass(s.asAdmin, { classId: 99999, toClassId: s.class8A.id })).rejects.toThrow(NotFound);
      await expect(promoteClass(s.asAdmin, { classId: s.class7A.id, toClassId: 99999 })).rejects.toThrow(NotFound);
    });

    test("a target Class in the same Grade: that isn't Promotion", async () => {
      const s = await yearEndSchool();
      await expect(promoteClass(s.asAdmin, { classId: s.class7A.id, toClassId: s.next7A.id })).rejects.toEqual(
        refusal("errors.promotionNeedsNextGrade"),
      );
    });

    test("a target Class in a Grade further on than the next one", async () => {
      const s = await yearEndSchool();
      const grade9 = await createGrade(s.asAdmin, { name: "Grade 9" });
      await setGradeOrder(s.asAdmin, { gradeId: grade9.id, order: 9 });
      const class9A = await createClass(s.asAdmin, {
        academicYearId: s.nextYear.id,
        gradeId: grade9.id,
        name: "9-A",
        classTeacherId: s.omar.userId,
      });

      await expect(promoteClass(s.asAdmin, { classId: s.class7A.id, toClassId: class9A.id })).rejects.toEqual(
        refusal("errors.promotionNeedsNextGrade"),
      );
      expect(await rosterNames(s, class9A.id, "2027-09-01")).toEqual([]);
    });

    test("a target Class in an earlier Grade", async () => {
      const s = await yearEndSchool();
      await setGradeOrder(s.asAdmin, { gradeId: s.grade8.id, order: 6 });

      await expect(promoteClass(s.asAdmin, { classId: s.class7A.id, toClassId: s.class8A.id })).rejects.toEqual(
        refusal("errors.promotionNeedsNextGrade"),
      );
    });

    test("a Grade with no order, on either side, until the Admin sets it", async () => {
      const s = await yearEndSchool();
      await setGradeOrder(s.asAdmin, { gradeId: s.grade8.id, order: null });
      await expect(promoteClass(s.asAdmin, { classId: s.class7A.id, toClassId: s.class8A.id })).rejects.toEqual(
        refusal("errors.promotionNeedsGradeOrder"),
      );

      await setGradeOrder(s.asAdmin, { gradeId: s.grade8.id, order: 8 });
      await setGradeOrder(s.asAdmin, { gradeId: s.grade7.id, order: null });
      await expect(promoteClass(s.asAdmin, { classId: s.class7A.id, toClassId: s.class8A.id })).rejects.toEqual(
        refusal("errors.promotionNeedsGradeOrder"),
      );

      await setGradeOrder(s.asAdmin, { gradeId: s.grade7.id, order: 7 });
      await promoteClass(s.asAdmin, { classId: s.class7A.id, toClassId: s.class8A.id });
      expect(await rosterNames(s, s.class8A.id, "2027-09-01")).toEqual(["Aisha Rahman", "Bilal Khan"]);
    });

    test("a target Class in the same Academic Year", async () => {
      const s = await yearEndSchool();
      const sameYear8 = await createClass(s.asAdmin, {
        academicYearId: s.year.id,
        gradeId: s.grade8.id,
        name: "8-early",
        classTeacherId: s.omar.userId,
      });
      await expect(promoteClass(s.asAdmin, { classId: s.class7A.id, toClassId: sameYear8.id })).rejects.toEqual(
        refusal("errors.promotionNeedsNextYear"),
      );
    });

    test("a Repeating Student's Class in another Grade", async () => {
      const s = await yearEndSchool();
      await expect(
        promoteClass(s.asAdmin, {
          classId: s.class7A.id,
          toClassId: s.class8A.id,
          repeating: [{ studentId: s.bilal, classId: s.class8B.id }],
        }),
      ).rejects.toEqual(refusal("errors.promotionRepeatNeedsSameGrade"));
    });

    test("a Student who isn't in the Class, or is listed twice", async () => {
      const s = await yearEndSchool();
      await expect(
        promoteClass(s.asAdmin, { classId: s.class7A.id, toClassId: s.class8A.id, leaving: [{ studentId: "nobody" }] }),
      ).rejects.toEqual(refusal("errors.promotionStudentNotInClass"));
      await expect(
        promoteClass(s.asAdmin, {
          classId: s.class7A.id,
          toClassId: s.class8A.id,
          leaving: [{ studentId: s.bilal }],
          repeating: [{ studentId: s.bilal, classId: s.next7A.id }],
        }),
      ).rejects.toEqual(refusal("errors.promotionStudentTwice"));
    });

    test("no target Class while a Student still needs one", async () => {
      const s = await yearEndSchool();
      await expect(
        promoteClass(s.asAdmin, { classId: s.class7A.id, leaving: [{ studentId: s.bilal }] }),
      ).rejects.toEqual(refusal("errors.promotionTargetRequired"));
    });

    test("a Leaving Student's last day before their Enrollment or after the year", async () => {
      const s = await yearEndSchool();
      for (const lastDay of ["2026-08-31", "2027-07-01", "not-a-date"]) {
        await expect(
          promoteClass(s.asAdmin, {
            classId: s.class7A.id,
            toClassId: s.class8A.id,
            leaving: [{ studentId: s.bilal, lastDay }],
          }),
        ).rejects.toEqual(refusal("errors.promotionLastDayInvalid"));
      }
    });

    test("a Class already promoted: nothing is left to promote, and nobody is enrolled twice", async () => {
      const s = await yearEndSchool();
      await promoteClass(s.asAdmin, { classId: s.class7A.id, toClassId: s.class8A.id });
      await expect(promoteClass(s.asAdmin, { classId: s.class7A.id, toClassId: s.class8B.id })).rejects.toEqual(
        refusal("errors.promotionNoStudents"),
      );
      expect(await rosterNames(s, s.class8B.id, "2027-09-01")).toEqual([]);
    });

    test("a refused Promotion changes nothing", async () => {
      const s = await yearEndSchool();
      await expect(
        promoteClass(s.asAdmin, { classId: s.class7A.id, toClassId: s.class8A.id, leaving: [{ studentId: "nobody" }] }),
      ).rejects.toBeInstanceOf(InvalidInput);
      expect(await rosterNames(s, s.class7A.id, "2027-07-01")).toEqual(["Aisha Rahman", "Bilal Khan"]);
      expect(await rosterNames(s, s.class8A.id, "2027-09-01")).toEqual([]);
    });
  });

  it("the Promotion form offers the Class's Students and the next year's Classes by Grade", async () => {
    const s = await yearEndSchool();

    const form = await promotionForm(s.asAdmin, { classId: s.class7A.id });

    expect(form.nextYear).toBe("2027-2028");
    expect(form.students.map((x) => x.name)).toEqual(["Aisha Rahman", "Bilal Khan"]);
    expect(form.targets.map((c) => c.name)).toEqual(["8-A", "8-B"]);
    expect(form.repeatTargets.map((c) => c.name)).toEqual(["7-A next"]);
    await expect(promotionForm(s.app.as(s.huda), { classId: s.class7A.id })).rejects.toThrow(AccessDenied);
  });
});

describe("the next Grade follows the Admin's order", () => {
  it("not the Grades' names or when they were created, and gaps in the numbers don't matter", async () => {
    const s = await yearEndSchool();
    const grade9 = await createGrade(s.asAdmin, { name: "A Grade named to sort first" });
    await setGradeOrder(s.asAdmin, { gradeId: s.grade8.id, order: 20 });
    await setGradeOrder(s.asAdmin, { gradeId: grade9.id, order: 15 });
    const class9A = await createClass(s.asAdmin, {
      academicYearId: s.nextYear.id,
      gradeId: grade9.id,
      name: "9-A",
      classTeacherId: s.omar.userId,
    });

    await expect(promoteClass(s.asAdmin, { classId: s.class7A.id, toClassId: s.class8A.id })).rejects.toEqual(
      refusal("errors.promotionNeedsNextGrade"),
    );
    expect((await promotionForm(s.asAdmin, { classId: s.class7A.id })).targets.map((c) => c.name)).toEqual(["9-A"]);

    await promoteClass(s.asAdmin, { classId: s.class7A.id, toClassId: class9A.id });
    expect(await rosterNames(s, class9A.id, "2027-09-01")).toEqual(["Aisha Rahman", "Bilal Khan"]);
  });

  it("the form offers only the next Grade's Classes", async () => {
    const s = await yearEndSchool();
    const grade9 = await createGrade(s.asAdmin, { name: "Grade 9" });
    await setGradeOrder(s.asAdmin, { gradeId: grade9.id, order: 9 });
    await createClass(s.asAdmin, {
      academicYearId: s.nextYear.id,
      gradeId: grade9.id,
      name: "9-A",
      classTeacherId: s.omar.userId,
    });

    const form = await promotionForm(s.asAdmin, { classId: s.class7A.id });

    expect(form.targets.map((c) => c.name)).toEqual(["8-A", "8-B"]);
    expect(form.noTargets).toBeNull();
  });

  it("a Grade with no order offers no target and says why, but Repeating and Leaving still work", async () => {
    const s = await yearEndSchool();
    await setGradeOrder(s.asAdmin, { gradeId: s.grade7.id, order: null });

    const form = await promotionForm(s.asAdmin, { classId: s.class7A.id });
    expect(form.targets).toEqual([]);
    expect(form.noTargets).toBe("gradeHasNoOrder");
    expect(form.repeatTargets.map((c) => c.name)).toEqual(["7-A next"]);

    await promoteClass(s.asAdmin, {
      classId: s.class7A.id,
      repeating: [{ studentId: s.aisha, classId: s.next7A.id }],
      leaving: [{ studentId: s.bilal }],
    });
    expect(await rosterNames(s, s.next7A.id, "2027-09-01")).toEqual(["Aisha Rahman"]);
  });

  it("the last Grade has no target, and its Students can still leave", async () => {
    const s = await yearEndSchool();
    await setGradeOrder(s.asAdmin, { gradeId: s.grade8.id, order: 3 });

    const form = await promotionForm(s.asAdmin, { classId: s.class7A.id });

    expect(form.targets).toEqual([]);
    expect(form.noTargets).toBe("lastGrade");
    await promoteClass(s.asAdmin, {
      classId: s.class7A.id,
      leaving: [{ studentId: s.aisha }, { studentId: s.bilal }],
    });
  });

  it("a next Grade with no Class in the new year says so", async () => {
    const s = await yearEndSchool();
    const grade9 = await createGrade(s.asAdmin, { name: "Grade 9" });
    await setGradeOrder(s.asAdmin, { gradeId: s.grade8.id, order: 9 });
    await setGradeOrder(s.asAdmin, { gradeId: grade9.id, order: 8 });

    const form = await promotionForm(s.asAdmin, { classId: s.class7A.id });

    expect(form.targets).toEqual([]);
    expect(form.noTargets).toBe("noClassInNextGrade");
  });
});

describe("Term Grades after year end", () => {
  const letters = {
    passMark: 50,
    bands: [
      { minPercent: 80, label: "A" },
      { minPercent: 0, label: "F" },
    ],
  };
  const descriptors = {
    passMark: 90,
    bands: [
      { minPercent: 70, label: "Secure" },
      { minPercent: 0, label: "Emerging" },
    ],
  };

  /** Sara's Math quiz in 7-A on the date, with Aisha's Mark out of 10. */
  const markedInMath7A = async (s: School, date: string, score: number) => {
    const { id } = await createAssessment(s.asSara, quiz(s.math7A.id, { date }));
    await saveMarks(s.asSara, { assessmentId: id, marks: [{ studentId: s.aisha, mark: score }] });
  };

  test("a Student with no Class on the Term's last day has a percentage but no label or pass or fail", async () => {
    const s = await yearEndSchool();
    await setGradingScale(s.asAdmin, { gradeId: s.grade7.id, ...letters });
    await markedInMath7A(s, "2026-09-20", 8);

    // She leaves during Term 1, which ends 2026-12-31.
    await promoteClass(s.asAdmin, {
      classId: s.class7A.id,
      toClassId: s.class8A.id,
      leaving: [{ studentId: s.aisha, lastDay: "2026-11-15" }],
    });

    const term1 = (await studentTermGrades(s.asAdmin, { studentId: s.aisha })).find((x) => x.term.name === "Term 1");
    expect(term1?.issuingClass).toBeNull();
    expect(term1?.grades).toMatchObject([{ subject: "Math", percent: 80, label: null, passed: null }]);
  });

  test("Promotion keeps each Term on its own Grade's Grading Scale: one Term never spans the two Grades", async () => {
    const s = await yearEndSchool();
    await setGradingScale(s.asAdmin, { gradeId: s.grade7.id, ...letters });
    await setGradingScale(s.asAdmin, { gradeId: s.grade8.id, ...descriptors });
    await markedInMath7A(s, "2026-09-20", 8);
    await promoteClass(s.asAdmin, { classId: s.class7A.id, toClassId: s.class8A.id });
    const math8A = await createClassSubject(s.asAdmin, {
      classId: s.class8A.id,
      subjectId: s.math.id,
      teacherId: s.sara.userId,
    });
    const { id } = await createAssessment(s.asSara, quiz(math8A.id, { date: "2027-10-01" }));
    await saveMarks(s.asSara, { assessmentId: id, marks: [{ studentId: s.aisha, mark: 8 }] });

    const terms = await studentTermGrades(s.asAdmin, { studentId: s.aisha });
    const inYear = (year: string, name: string) =>
      terms.find((x) => x.term.academicYear === year && x.term.name === name);

    // The same 80% reads differently on each Scale.
    expect(inYear("2026-2027", "Term 1")).toMatchObject({
      issuingClass: { name: "7-A" },
      grades: [{ percent: 80, label: "A", passed: true }],
    });
    expect(inYear("2027-2028", "Term 1")).toMatchObject({
      issuingClass: { name: "8-A" },
      grades: [{ percent: 80, label: "Secure", passed: false }],
    });
  });

  test("the label comes from the Issuing Class's Grade when a Leaving Student rejoins another Grade in the same Term", async () => {
    const s = await yearEndSchool();
    await setGradingScale(s.asAdmin, { gradeId: s.grade7.id, ...letters });
    await setGradingScale(s.asAdmin, { gradeId: s.grade8.id, ...descriptors });
    await markedInMath7A(s, "2026-09-20", 8);
    const sameYear8 = await createClass(s.asAdmin, {
      academicYearId: s.year.id,
      gradeId: s.grade8.id,
      name: "8-early",
      classTeacherId: s.omar.userId,
    });

    // Promotion alone can't do this: only a Leaving Student's early last day plus a new
    // Enrollment puts two Grades in one Term.
    await promoteClass(s.asAdmin, {
      classId: s.class7A.id,
      toClassId: s.class8A.id,
      leaving: [{ studentId: s.aisha, lastDay: "2026-10-10" }],
    });
    await enrollStudent(s.asAdmin, { studentId: s.aisha, classId: sameYear8.id, startDate: "2026-10-11" });

    const term1 = (await studentTermGrades(s.asAdmin, { studentId: s.aisha })).find((x) => x.term.name === "Term 1");
    expect(term1?.issuingClass).toMatchObject({ name: "8-early", grade: "Grade 8" });
    expect(term1?.grades).toMatchObject([{ percent: 80, label: "Secure", passed: false }]);
  });
});

describe("a Closed year's Term Grades keep the Grading Scale it Closed with", () => {
  const letters = { passMark: 50, bands: [{ minPercent: 75, label: "A" }, { minPercent: 0, label: "F" }] };
  const raised = { passMark: 90, bands: [{ minPercent: 85, label: "Merit" }, { minPercent: 0, label: "Below" }] };

  /** Aisha has 80% in 7-A's Math in Term 1. The year then rolls over and Closes. */
  const closedYear = async () => {
    const s = await yearEndSchool();
    await setGradingScale(s.asAdmin, { gradeId: s.grade7.id, ...letters });
    const { id } = await createAssessment(s.asSara, quiz(s.math7A.id));
    await saveMarks(s.asSara, { assessmentId: id, marks: [{ studentId: s.aisha, mark: 8 }] });
    return s;
  };
  const inClosedYear = async (s: School) =>
    (await studentTermGrades(s.asAdmin, { studentId: s.aisha })).find((x) => x.term.academicYear === "2026-2027");

  it("editing the Scale after Closing leaves the label and pass or fail unchanged, wherever they're read", async () => {
    const s = await closedYear();
    await promoteAndClose(s);
    const [term1] = (await listAcademicYears(s.asAdmin)).find((y) => y.id === s.year.id)!.terms;

    await setGradingScale(s.asAdmin, { gradeId: s.grade7.id, ...raised });

    expect((await inClosedYear(s))?.grades).toMatchObject([{ percent: 80, label: "A", passed: true }]);
    const classSubject = await classSubjectTermGrades(s.asAdmin, { classSubjectId: s.math7A.id, termId: term1.id });
    expect(classSubject.rows.find((r) => r.studentId === s.aisha)?.grade).toMatchObject({ label: "A", passed: true });
    const cards = await classReportCards(s.asAdmin, { classId: s.class7A.id, termId: term1.id });
    expect(cards.cards.find((c) => c.studentId === s.aisha)?.grades).toMatchObject([{ label: "A", passed: true }]);
  });

  it("the live Scale still changes, and open years follow it", async () => {
    const s = await closedYear();
    const math = await createClassSubject(s.asAdmin, {
      classId: s.next7A.id,
      subjectId: s.math.id,
      teacherId: s.sara.userId,
    });
    await promoteClass(s.asAdmin, {
      classId: s.class7A.id,
      toClassId: s.class8A.id,
      repeating: [{ studentId: s.aisha, classId: s.next7A.id }],
    });
    await closeAcademicYear(s.asAdmin, { academicYearId: s.year.id });
    const { id } = await createAssessment(s.asSara, quiz(math.id, { date: "2027-10-01" }));
    await saveMarks(s.asSara, { assessmentId: id, marks: [{ studentId: s.aisha, mark: 8 }] });
    const inOpenYear = async () =>
      (await studentTermGrades(s.asAdmin, { studentId: s.aisha })).find((x) => x.term.academicYear === "2027-2028");
    expect((await inOpenYear())?.grades).toMatchObject([{ label: "A", passed: true }]);

    await setGradingScale(s.asAdmin, { gradeId: s.grade7.id, ...raised });

    expect(await getGradingScale(s.asAdmin, { gradeId: s.grade7.id })).toEqual(raised);
    expect((await inOpenYear())?.grades).toMatchObject([{ label: "Below", passed: false }]);
    // The same Grade, the same 80%, in the Closed year: still as it Closed.
    expect((await inClosedYear(s))?.grades).toMatchObject([{ label: "A", passed: true }]);
  });

  it("before Closing the live Scale applies, and Closing keeps the Scale as it stands then", async () => {
    const s = await closedYear();
    await setGradingScale(s.asAdmin, { gradeId: s.grade7.id, ...raised });
    expect((await inClosedYear(s))?.grades).toMatchObject([{ label: "Below", passed: false }]);

    await promoteAndClose(s);
    await setGradingScale(s.asAdmin, { gradeId: s.grade7.id, ...letters });

    expect((await inClosedYear(s))?.grades).toMatchObject([{ label: "Below", passed: false }]);
  });

  it("a Grade with no Scale at Closing stays without a label, even if it gets one later", async () => {
    const s = await yearEndSchool();
    const { id } = await createAssessment(s.asSara, quiz(s.math7A.id));
    await saveMarks(s.asSara, { assessmentId: id, marks: [{ studentId: s.aisha, mark: 8 }] });
    await promoteAndClose(s);

    await setGradingScale(s.asAdmin, { gradeId: s.grade7.id, ...letters });

    expect((await inClosedYear(s))?.grades).toMatchObject([{ percent: 80, label: null, passed: null }]);
  });

  it("each Closed year keeps its own Scale", async () => {
    const s = await closedYear();
    await promoteClass(s.asAdmin, {
      classId: s.class7A.id,
      toClassId: s.class8A.id,
      repeating: [{ studentId: s.aisha, classId: s.next7A.id }],
    });
    await closeAcademicYear(s.asAdmin, { academicYearId: s.year.id });
    await setGradingScale(s.asAdmin, { gradeId: s.grade7.id, ...raised });
    const math = await createClassSubject(s.asAdmin, {
      classId: s.next7A.id,
      subjectId: s.math.id,
      teacherId: s.sara.userId,
    });
    const { id } = await createAssessment(s.asSara, quiz(math.id, { date: "2027-10-01" }));
    await saveMarks(s.asSara, { assessmentId: id, marks: [{ studentId: s.aisha, mark: 8 }] });
    await promoteClass(s.asAdmin, { classId: s.next7A.id, leaving: [{ studentId: s.aisha }] });
    await promoteClass(s.asAdmin, { classId: s.class8A.id, leaving: [{ studentId: s.bilal }] });
    await closeAcademicYear(s.asAdmin, { academicYearId: s.nextYear.id });
    await setGradingScale(s.asAdmin, { gradeId: s.grade7.id, ...letters });

    const terms = await studentTermGrades(s.asAdmin, { studentId: s.aisha });
    const labelIn = (year: string) => terms.find((x) => x.term.academicYear === year)?.grades[0].label;
    expect(labelIn("2026-2027")).toBe("A");
    expect(labelIn("2027-2028")).toBe("Below");
  });
});

describe("Closing an Academic Year", () => {
  it("the Admin Closes a year after Promotion, and it shows as Closed", async () => {
    const s = await yearEndSchool();

    await promoteAndClose(s);

    const years = await listAcademicYears(s.asAdmin);
    expect(years.find((y) => y.id === s.year.id)?.closed).toBe(true);
    expect(years.find((y) => y.id === s.nextYear.id)?.closed).toBe(false);
  });

  it("a year can't be Closed while a Student is still waiting for Promotion", async () => {
    const s = await yearEndSchool();
    await expect(closeAcademicYear(s.asAdmin, { academicYearId: s.year.id })).rejects.toThrow(PromotionNotDone);
    expect((await listAcademicYears(s.asAdmin)).find((y) => y.id === s.year.id)?.closed).toBe(false);
  });

  it("only the Admin Closes, and only a year that exists and is still open", async () => {
    const s = await yearEndSchool();
    await expect(closeAcademicYear(s.app.as(s.huda), { academicYearId: s.year.id })).rejects.toThrow(AccessDenied);
    await expect(closeAcademicYear(s.asAdmin, { academicYearId: 99999 })).rejects.toThrow(NotFound);
    await promoteAndClose(s);
    await expect(closeAcademicYear(s.asAdmin, { academicYearId: s.year.id })).rejects.toThrow(AcademicYearClosed);
  });

  it("the year-end overview says which Classes still wait and whether the year can be Closed", async () => {
    const s = await yearEndSchool();
    const inYear = async () => (await yearEndOverview(s.asAdmin)).find((y) => y.id === s.year.id);

    expect(await inYear()).toMatchObject({ closed: false, canClose: false });
    expect((await inYear())?.classes.find((c) => c.id === s.class7A.id)?.awaitingPromotion).toBe(2);

    await promoteClass(s.asAdmin, { classId: s.class7A.id, toClassId: s.class8A.id });
    expect(await inYear()).toMatchObject({ closed: false, canClose: true });

    await closeAcademicYear(s.asAdmin, { academicYearId: s.year.id });
    expect(await inYear()).toMatchObject({ closed: true, canClose: false });
    await expect(yearEndOverview(s.app.as(s.huda))).rejects.toThrow(AccessDenied);
  });

  it("a write in progress holds Closing back, so it can't slip in behind the check", async () => {
    const s = await yearEndSchool();
    await promoteClass(s.asAdmin, { classId: s.class7A.id, toClassId: s.class8A.id });

    let release = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    let guarded = () => {};
    const guardHeld = new Promise<void>((resolve) => (guarded = resolve));
    const writing = s.asAdmin.db.transaction(async (tx) => {
      await requireOpenYear(tx, { academicYearId: s.year.id });
      guarded();
      await gate;
    });
    await guardHeld;

    let closed = false;
    const closing = closeAcademicYear(s.asAdmin, { academicYearId: s.year.id }).then(() => {
      closed = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(closed).toBe(false);

    release();
    await writing;
    await closing;
    expect(closed).toBe(true);
  });
});

describe("a Closed Academic Year refuses every write dated in it", () => {
  /** A year with one of everything, Closed: the records the refusals below try to change. */
  const closedSchool = async () => {
    const s = await yearEndSchool();
    await setPeriodsPerDay(s.asAdmin, 6);
    const { id: assessmentId } = await createAssessment(s.asSara, quiz(s.math7A.id));
    await saveMarks(s.asSara, { assessmentId, marks: [{ studentId: s.aisha, mark: 8 }] });
    await logLesson(s.asSara, { classSubjectId: s.math7A.id, date: "2026-10-01", period: 1, topic: "Fractions" });
    const room = await createRoom(s.asAdmin, { name: "Hall" });
    await promoteAndClose(s);
    return { ...s, assessmentId, room };
  };

  test("Lessons", async () => {
    const s = await closedSchool();
    await expect(
      logLesson(s.asSara, { classSubjectId: s.math7A.id, date: "2026-10-02", period: 1, topic: "Decimals" }),
    ).rejects.toThrow(AcademicYearClosed);
  });

  test("Assessments, new or changed", async () => {
    const s = await closedSchool();
    await expect(createAssessment(s.asSara, quiz(s.math7A.id))).rejects.toThrow(AcademicYearClosed);
    await expect(
      updateAssessment(s.asSara, { assessmentId: s.assessmentId, maxMarks: 20, weight: 2 }),
    ).rejects.toThrow(AcademicYearClosed);
  });

  test("Marks", async () => {
    const s = await closedSchool();
    await expect(
      saveMarks(s.asSara, { assessmentId: s.assessmentId, marks: [{ studentId: s.aisha, mark: 9 }] }),
    ).rejects.toThrow(AcademicYearClosed);
    expect((await marksGrid(s.asSara, { assessmentId: s.assessmentId })).rows[0].mark).toBe(8);
  });

  test("Publish and unpublish, while Published Report Cards stay readable", async () => {
    const s = await yearEndSchool();
    const { id: assessmentId } = await createAssessment(s.asSara, quiz(s.math7A.id));
    await saveMarks(s.asSara, { assessmentId, marks: [{ studentId: s.aisha, mark: 8 }] });
    const { terms } = await classReportCards(s.asAdmin, { classId: s.class7A.id });
    const [term1, term2] = terms;
    await publishReportCards(s.asAdmin, { classId: s.class7A.id, termId: term1.id });
    await promoteAndClose(s);

    await expect(publishReportCards(s.asAdmin, { classId: s.class7A.id, termId: term2.id })).rejects.toThrow(
      AcademicYearClosed,
    );
    await expect(unpublishReportCards(s.asAdmin, { classId: s.class7A.id, termId: term1.id })).rejects.toThrow(
      AcademicYearClosed,
    );
    const asAisha = s.app.as({ role: "student", userId: s.aisha });
    expect(await studentReportCards(asAisha, { studentId: s.aisha })).toHaveLength(1);
    const preview = await classReportCards(s.asAdmin, { classId: s.class7A.id, termId: term1.id });
    expect(preview).toMatchObject({ yearClosed: true, publication: { unpublishedAt: null } });
  });

  test("Report Card remarks, new, changed or cleared, while they stay readable", async () => {
    const s = await yearEndSchool();
    const { term } = await classReportCards(s.asAdmin, { classId: s.class7A.id });
    const subjectInput = { classSubjectId: s.math7A.id, termId: term.id, studentId: s.aisha };
    const overallInput = { classId: s.class7A.id, termId: term.id, studentId: s.aisha };
    await saveSubjectRemark(s.asSara, { ...subjectInput, remark: "Written in time." });
    await saveOverallRemark(s.asHuda, { ...overallInput, remark: "Also in time." });
    await promoteAndClose(s);

    for (const remark of ["Too late.", ""]) {
      await expect(saveSubjectRemark(s.asSara, { ...subjectInput, remark })).rejects.toThrow(AcademicYearClosed);
      await expect(saveOverallRemark(s.asHuda, { ...overallInput, remark })).rejects.toThrow(AcademicYearClosed);
    }
    await expect(saveSubjectRemark(s.asSara, { ...subjectInput, studentId: s.bilal, remark: "New." })).rejects.toThrow(
      AcademicYearClosed,
    );

    const { cards } = await classReportCards(s.asAdmin, { classId: s.class7A.id, termId: term.id });
    const aisha = cards.find((c) => c.studentId === s.aisha);
    expect(aisha?.overallRemark).toBe("Also in time.");
    expect(aisha?.grades[0].remark).toBe("Written in time.");
    const sheet = await subjectRemarkSheet(s.asSara, { classSubjectId: s.math7A.id, termId: term.id });
    expect(sheet.yearClosed).toBe(true);
    expect((await overallRemarkSheet(s.asHuda, { classId: s.class7A.id, termId: term.id })).yearClosed).toBe(true);
  });

  test("Exams", async () => {
    const s = await closedSchool();
    await expect(
      addExam(s.asAdmin, {
        classSubjectId: s.math7A.id,
        roomId: s.room.id,
        type: "final",
        date: "2027-06-01",
        startTime: "09:00",
        durationMinutes: 60,
        maxMarks: 100,
        weight: 5,
      }),
    ).rejects.toThrow(AcademicYearClosed);
  });

  test("Enrollments", async () => {
    const s = await closedSchool();
    const { studentId } = await s.newStudent("Carla Nunes", "S-3");
    await expect(
      enrollStudent(s.asAdmin, { studentId, classId: s.class7B.id, startDate: "2027-01-10" }),
    ).rejects.toThrow(AcademicYearClosed);
  });

  test("Classes, Class Subjects and the year itself", async () => {
    const s = await closedSchool();
    await expect(
      createClass(s.asAdmin, {
        academicYearId: s.year.id,
        gradeId: s.grade7.id,
        name: "7-C",
        classTeacherId: s.omar.userId,
      }),
    ).rejects.toThrow(AcademicYearClosed);
    await expect(
      createClassSubject(s.asAdmin, { classId: s.class7A.id, subjectId: s.science.id, teacherId: s.omar.userId }),
    ).rejects.toThrow(AcademicYearClosed);
    await expect(
      reassignSubjectTeacher(s.asAdmin, { classSubjectId: s.math7A.id, teacherId: s.omar.userId }),
    ).rejects.toThrow(AcademicYearClosed);
    await expect(
      updateAcademicYear(s.asAdmin, {
        id: s.year.id,
        name: "renamed",
        startDate: "2026-09-01",
        endDate: "2027-06-30",
        terms: [{ name: "Whole year", startDate: "2026-09-01", endDate: "2027-06-30" }],
      }),
    ).rejects.toThrow(AcademicYearClosed);
  });

  test("Promotion out of it", async () => {
    const s = await closedSchool();
    await expect(promoteClass(s.asAdmin, { classId: s.class7B.id, toClassId: s.class8B.id })).rejects.toThrow(
      AcademicYearClosed,
    );
  });

  test("Promotion into it, even from a year still open", async () => {
    const s = await yearEndSchool();
    await closeAcademicYear(s.asAdmin, { academicYearId: s.nextYear.id });
    await expect(promoteClass(s.asAdmin, { classId: s.class7A.id, toClassId: s.class8A.id })).rejects.toThrow(
      AcademicYearClosed,
    );
  });

  test("the guard answers for a Term and refuses an unknown record", async () => {
    const s = await closedSchool();
    const [year] = (await listAcademicYears(s.asAdmin)).filter((y) => y.id === s.year.id);
    await expect(
      s.asAdmin.db.transaction((tx) => requireOpenYear(tx, { termId: year.terms[0].id })),
    ).rejects.toThrow(AcademicYearClosed);
    await expect(
      s.asAdmin.db.transaction((tx) => requireOpenYear(tx, { classSubjectId: 99999 })),
    ).rejects.toThrow(NotFound);
  });

  test("the next year's writes are untouched", async () => {
    const s = await closedSchool();
    const math8A = await createClassSubject(s.asAdmin, {
      classId: s.class8A.id,
      subjectId: s.math.id,
      teacherId: s.sara.userId,
    });
    await expect(createAssessment(s.asSara, quiz(math8A.id, { date: "2027-10-01" }))).resolves.toBeDefined();
  });

  test("the Subject Teacher is offered no forms for a Closed year", async () => {
    const s = await closedSchool();
    expect((await marksGrid(s.asSara, { assessmentId: s.assessmentId })).canEnterMarks).toBe(false);
    await expect(lessonFormDefaults(s.asSara, { classSubjectId: s.math7A.id })).rejects.toThrow(AcademicYearClosed);
  });

  test("Closed years stay viewable to everyone with access", async () => {
    const s = await closedSchool();

    expect(await rosterNames(s, s.class7A.id, "2027-01-10")).toEqual(["Aisha Rahman", "Bilal Khan"]);
    expect((await getClass(s.asHuda, { classId: s.class7A.id })).yearClosed).toBe(true);
    expect((await listClassSubjects(s.asAdmin, { classId: s.class7A.id })).map((cs) => cs.subject)).toEqual(["Math"]);
    expect((await listClassLessons(s.asHuda, { classId: s.class7A.id })).map((l) => l.topic)).toEqual(["Fractions"]);
    expect(await examTimetable(s.asAdmin, { termId: (await listAcademicYears(s.asAdmin))[1].terms[0].id })).not.toBeNull();
    const asStudent = s.app.as({ role: "student", userId: s.aisha });
    expect((await studentAssessmentHistory(asStudent, { studentId: s.aisha }))[0]).toMatchObject({ mark: 8 });
  });
});

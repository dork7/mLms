import { describe, expect, test } from "vitest";
import { sql } from "drizzle-orm";
import { createAssessment, updateAssessment } from "../assessments/assessments";
import { type MarkValue, marksGrid, saveMarks } from "../assessments/marks";
import { assessmentSchool, quiz } from "../assessments/test-assessments";
import { reassignSubjectTeacher } from "../classes/class-subjects";
import { enrollStudent, moveStudent } from "../enrollment/enrollment";
import {
  AccessDenied,
  AlreadyPublished,
  InvalidInput,
  NotFound,
  NotPublished,
  ReportCardsPublished,
} from "../errors";
import { setGradingScale } from "../grading/grading-scales";
import { updateAcademicYear } from "../school/academic-year";
import { registerStudent } from "../students/register-student";
import { yearEndSchool } from "../year-end/test-year-end";
import { promoteClass } from "../year-end/year-end";
import { publishReportCards, studentReportCards, unpublishReportCards } from "./publish";
import { setRankEnabled } from "./rank-setting";
import { overallRemarkSheet, saveOverallRemark, saveSubjectRemark, subjectRemarkSheet } from "./remarks";
import { classReportCards } from "./report-cards";

type School = Awaited<ReturnType<typeof assessmentSchool>>;

/** An Assessment in a Class Subject with Marks, entered by its Subject Teacher. */
async function marked(s: School, classSubjectId: number, marks: Record<string, MarkValue>, date = "2026-09-20") {
  const { id } = await createAssessment(s.asSara, quiz(classSubjectId, { date }));
  await saveMarks(s.asSara, {
    assessmentId: id,
    marks: Object.entries(marks).map(([studentId, mark]) => ({ studentId, mark })),
  });
  return id;
}

/** Term 1 and Term 2 of the fixture's year. */
async function terms(s: School) {
  const { terms } = await classReportCards(s.asAdmin, { classId: s.class7A.id });
  return { term1: terms[0], term2: terms[1] };
}

describe("Publishing a Class's Report Cards", () => {
  test("only an Admin can Publish", async () => {
    const s = await assessmentSchool();
    await marked(s, s.math7A.id, { [s.aisha]: 8 });
    const { term1 } = await terms(s);
    const input = { classId: s.class7A.id, termId: term1.id };

    await expect(publishReportCards(s.asHuda, input)).rejects.toThrow(AccessDenied);
    await expect(publishReportCards(s.asSara, input)).rejects.toThrow(AccessDenied);
    await expect(publishReportCards(s.app.as({ role: "student", userId: s.aisha }), input)).rejects.toThrow(AccessDenied);

    expect((await classReportCards(s.asAdmin, input)).publication).toBeNull();
  });

  test("a Student sees their Report Card only once it's Published, and only their own", async () => {
    const s = await assessmentSchool();
    await marked(s, s.math7A.id, { [s.aisha]: 8, [s.bilal]: 5 });
    const { term1 } = await terms(s);
    const asAisha = s.app.as({ role: "student", userId: s.aisha });

    expect(await studentReportCards(asAisha, { studentId: s.aisha })).toEqual([]);

    await publishReportCards(s.asAdmin, { classId: s.class7A.id, termId: term1.id });

    const cards = await studentReportCards(asAisha, { studentId: s.aisha });
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ studentId: s.aisha, overallPercent: 80 });
    expect(cards[0].term).toMatchObject({ name: "Term 1", academicYear: "2026-2027" });
    await expect(studentReportCards(asAisha, { studentId: s.bilal })).rejects.toThrow(AccessDenied);
  });

  test("a Teacher can't read a Student's Published Report Cards, and the Admin can", async () => {
    const s = await assessmentSchool();
    await marked(s, s.math7A.id, { [s.aisha]: 8 });
    const { term1 } = await terms(s);
    await publishReportCards(s.asAdmin, { classId: s.class7A.id, termId: term1.id });

    await expect(studentReportCards(s.asHuda, { studentId: s.aisha })).rejects.toThrow(AccessDenied);
    expect(await studentReportCards(s.asAdmin, { studentId: s.aisha })).toHaveLength(1);
  });

  test("Publishing twice is refused, and so is a Term of another year", async () => {
    const s = await yearEndSchool();
    await marked(s, s.math7A.id, { [s.aisha]: 8 });
    const { term1 } = await terms(s);
    const input = { classId: s.class7A.id, termId: term1.id };
    await publishReportCards(s.asAdmin, input);

    await expect(publishReportCards(s.asAdmin, input)).rejects.toThrow(AlreadyPublished);
    const [nextYearTerm] = (await classReportCards(s.asAdmin, { classId: s.class8A.id })).terms;
    await expect(publishReportCards(s.asAdmin, { classId: s.class7A.id, termId: nextYearTerm.id })).rejects.toThrow(NotFound);
  });

  test("a Class that issues no Report Card has nothing to Publish", async () => {
    const s = await assessmentSchool();
    const { term1 } = await terms(s);
    await expect(publishReportCards(s.asAdmin, { classId: s.class7B.id, termId: term1.id })).rejects.toThrow(InvalidInput);
    expect((await classReportCards(s.asAdmin, { classId: s.class7B.id, termId: term1.id })).publication).toBeNull();
  });

  test("Publish doesn't wait for a Student with no Issuing Class, who gets no Report Card", async () => {
    const s = await assessmentSchool();
    await marked(s, s.math7A.id, { [s.aisha]: 8, [s.bilal]: 5 });
    const { term1 } = await terms(s);
    await promoteClass(s.asAdmin, {
      classId: s.class7A.id,
      leaving: [{ studentId: s.aisha, lastDay: "2026-10-01" }, { studentId: s.bilal }],
    });

    await publishReportCards(s.asAdmin, { classId: s.class7A.id, termId: term1.id });

    expect(await studentReportCards(s.app.as({ role: "student", userId: s.aisha }), { studentId: s.aisha })).toEqual([]);
    expect(await studentReportCards(s.app.as({ role: "student", userId: s.bilal }), { studentId: s.bilal })).toHaveLength(1);
  });

  test("an incomplete Report Card can still be Published, and the preview still says what's missing", async () => {
    const s = await assessmentSchool();
    await marked(s, s.math7A.id, { [s.aisha]: 8 });
    const { term1 } = await terms(s);
    const input = { classId: s.class7A.id, termId: term1.id };

    await publishReportCards(s.asAdmin, input);

    const { cards, publication } = await classReportCards(s.asAdmin, input);
    expect(publication).not.toBeNull();
    expect(cards.find((c) => c.studentId === s.bilal)?.flags).toContainEqual({ kind: "missingMarks", subject: "Math", count: 1 });
  });
});

describe("while a Class's Report Cards are Published", () => {
  /** 7-A has a Mark for both Students in Term 1 and Term 2, and is Published for Term 1. */
  async function published() {
    const s = await assessmentSchool();
    const inTerm1 = await marked(s, s.math7A.id, { [s.aisha]: 8, [s.bilal]: 5 });
    const inTerm2 = await marked(s, s.math7A.id, { [s.aisha]: 7 }, "2027-02-01");
    const { term1, term2 } = await terms(s);
    const input = { classId: s.class7A.id, termId: term1.id };
    await publishReportCards(s.asAdmin, input);
    return { ...s, inTerm1, inTerm2, term1, term2, input };
  }

  test("every Mark write for that Term's Assessments is refused: a score, a status or clearing it", async () => {
    const s = await published();
    for (const mark of [9, "absent", "exempt", null] as const) {
      await expect(
        saveMarks(s.asSara, { assessmentId: s.inTerm1, marks: [{ studentId: s.aisha, mark }] }),
      ).rejects.toThrow(ReportCardsPublished);
    }
    const { rows } = await marksGrid(s.asSara, { assessmentId: s.inTerm1 });
    expect(rows.find((r) => r.studentId === s.aisha)?.mark).toBe(8);
  });

  test("an Assessment added to the Term after Publish can't get a Mark either", async () => {
    const s = await published();
    const { id } = await createAssessment(s.asSara, quiz(s.math7A.id, { date: "2026-11-01" }));
    await expect(saveMarks(s.asSara, { assessmentId: id, marks: [{ studentId: s.aisha, mark: 9 }] })).rejects.toThrow(
      ReportCardsPublished,
    );
  });

  test("another Term, and another Class in the same Term, still take Marks", async () => {
    const s = await published();
    await saveMarks(s.asSara, { assessmentId: s.inTerm2, marks: [{ studentId: s.aisha, mark: 9 }] });
    const dana = await registerStudent(s.asAdmin, {
      name: "Dana Saleh",
      studentNumber: "S-77",
      dateOfBirth: "2013-04-12",
      nationalId: "784-S-77",
      guardianContact: "Guardian",
      admissionDate: "2026-08-25",
    });
    await enrollStudent(s.asAdmin, { studentId: dana.studentId, classId: s.class7B.id, startDate: "2026-09-01" });
    const in7B = await marked(s, s.math7B.id, { [dana.studentId]: 6 });
    expect((await marksGrid(s.asSara, { assessmentId: in7B })).rows[0].mark).toBe(6);
  });

  test("an Assessment's maximum and weight are refused too", async () => {
    const s = await published();
    await expect(updateAssessment(s.asSara, { assessmentId: s.inTerm1, maxMarks: 20, weight: 2 })).rejects.toThrow(
      ReportCardsPublished,
    );
    const { assessment } = await marksGrid(s.asSara, { assessmentId: s.inTerm1 });
    expect(assessment).toMatchObject({ maxMarks: 10, weight: 1 });
    await updateAssessment(s.asSara, { assessmentId: s.inTerm2, maxMarks: 20, weight: 2 });
  });

  test("the grid says it can't be changed, and only for that Term", async () => {
    const s = await published();
    const frozen = await marksGrid(s.asSara, { assessmentId: s.inTerm1 });
    expect(frozen).toMatchObject({ canEnterMarks: false, canChangeAssessment: false });
    expect(frozen.rows.every((r) => r.published)).toBe(true);
    const open = await marksGrid(s.asSara, { assessmentId: s.inTerm2 });
    expect(open).toMatchObject({ canEnterMarks: true, canChangeAssessment: true });
    expect(open.rows.some((r) => r.published)).toBe(false);
  });

  test("remarks on a Published Report Card are refused, new, changed or cleared", async () => {
    const s = await assessmentSchool();
    await marked(s, s.math7A.id, { [s.aisha]: 8 });
    const { term1, term2 } = await terms(s);
    const subject = { classSubjectId: s.math7A.id, termId: term1.id, studentId: s.aisha };
    const overall = { classId: s.class7A.id, termId: term1.id, studentId: s.aisha };
    await saveSubjectRemark(s.asSara, { ...subject, remark: "In time." });
    await publishReportCards(s.asAdmin, { classId: s.class7A.id, termId: term1.id });

    for (const remark of ["Too late.", ""]) {
      await expect(saveSubjectRemark(s.asSara, { ...subject, remark })).rejects.toThrow(ReportCardsPublished);
      await expect(saveOverallRemark(s.asHuda, { ...overall, remark })).rejects.toThrow(ReportCardsPublished);
    }
    const sheet = await subjectRemarkSheet(s.asSara, { classSubjectId: s.math7A.id, termId: term1.id });
    expect(sheet.rows.find((r) => r.studentId === s.aisha)).toMatchObject({ remark: "In time.", published: true });
    const overallSheet = await overallRemarkSheet(s.asHuda, { classId: s.class7A.id, termId: term1.id });
    expect(overallSheet.rows.find((r) => r.studentId === s.aisha)?.published).toBe(true);

    // Another Term's remarks are still open.
    await saveOverallRemark(s.asHuda, { ...overall, termId: term2.id, remark: "Next Term." });
    const next = await overallRemarkSheet(s.asHuda, { classId: s.class7A.id, termId: term2.id });
    expect(next.rows.find((r) => r.studentId === s.aisha)).toMatchObject({ overallRemark: "Next Term.", published: false });
  });
});

describe("a Student who moved Class during the Term (the Aisha scenario)", () => {
  /** Aisha has a 7-A Mark, then moves to 7-B in week 6. Bilal stays in 7-A. */
  async function moved() {
    const s = await assessmentSchool();
    const in7A = await marked(s, s.math7A.id, { [s.aisha]: 8, [s.bilal]: 5 });
    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-10-10" });
    const { term1 } = await terms(s);
    return { ...s, in7A, term1 };
  }

  test("Publishing her Issuing Class freezes her Marks from the Class she left, which count on her card", async () => {
    const s = await moved();
    await publishReportCards(s.asAdmin, { classId: s.class7B.id, termId: s.term1.id });

    await expect(saveMarks(s.asSara, { assessmentId: s.in7A, marks: [{ studentId: s.aisha, mark: 9 }] })).rejects.toThrow(
      ReportCardsPublished,
    );
    // Her card is 7-B's, so 7-A's Marks stay open for Bilal.
    await saveMarks(s.asSara, { assessmentId: s.in7A, marks: [{ studentId: s.bilal, mark: 6 }] });
  });

  test("the old Class's grid stays open for the others, and marks her row as Published", async () => {
    const s = await moved();
    await publishReportCards(s.asAdmin, { classId: s.class7B.id, termId: s.term1.id });

    const grid = await marksGrid(s.asSara, { assessmentId: s.in7A });
    expect(grid.canEnterMarks).toBe(true);
    expect(grid.rows.find((r) => r.studentId === s.aisha)?.published).toBe(true);
    expect(grid.rows.find((r) => r.studentId === s.bilal)?.published).toBe(false);
    // Its maximum and weight reach her Mark, so they can't change.
    expect(grid.canChangeAssessment).toBe(false);
    await expect(updateAssessment(s.asSara, { assessmentId: s.in7A, maxMarks: 20, weight: 1 })).rejects.toThrow(
      ReportCardsPublished,
    );
  });

  test("a grid save that includes her frozen Mark is refused whole: nothing is saved", async () => {
    const s = await moved();
    await publishReportCards(s.asAdmin, { classId: s.class7B.id, termId: s.term1.id });

    await expect(
      saveMarks(s.asSara, {
        assessmentId: s.in7A,
        marks: [
          { studentId: s.bilal, mark: 6 },
          { studentId: s.aisha, mark: 9 },
        ],
      }),
    ).rejects.toThrow(ReportCardsPublished);
    const { rows } = await marksGrid(s.asSara, { assessmentId: s.in7A });
    expect(rows.find((r) => r.studentId === s.bilal)?.mark).toBe(5);
  });

  test("Publishing the old Class freezes its Term's Marks, hers on its roster included", async () => {
    const s = await moved();
    await publishReportCards(s.asAdmin, { classId: s.class7A.id, termId: s.term1.id });

    await expect(saveMarks(s.asSara, { assessmentId: s.in7A, marks: [{ studentId: s.aisha, mark: 9 }] })).rejects.toThrow(
      ReportCardsPublished,
    );
    // No Report Card of hers came from 7-A, and her 7-B card is still only a draft.
    expect(await studentReportCards(s.asAdmin, { studentId: s.aisha })).toEqual([]);
  });
});

describe("unpublishing", () => {
  async function published() {
    const s = await assessmentSchool();
    const assessmentId = await marked(s, s.math7A.id, { [s.aisha]: 8 });
    const { term1 } = await terms(s);
    const input = { classId: s.class7A.id, termId: term1.id };
    s.app.clock.set("2027-01-05T09:00:00+04:00");
    await publishReportCards(s.asAdmin, input);
    return { ...s, assessmentId, term1, input };
  }

  test("only an Admin can unpublish", async () => {
    const s = await published();
    await expect(unpublishReportCards(s.asHuda, s.input)).rejects.toThrow(AccessDenied);
    await expect(unpublishReportCards(s.app.as({ role: "student", userId: s.aisha }), s.input)).rejects.toThrow(AccessDenied);
    expect((await classReportCards(s.asAdmin, s.input)).publication).not.toBeNull();
  });

  test("there must be something to unpublish", async () => {
    const s = await assessmentSchool();
    const { term1 } = await terms(s);
    await expect(unpublishReportCards(s.asAdmin, { classId: s.class7A.id, termId: term1.id })).rejects.toThrow(NotPublished);
  });

  test("who unpublished and when is recorded, and the Publish stays on record", async () => {
    const s = await published();
    s.app.clock.set("2027-01-09T10:30:00+04:00");
    const before = await classReportCards(s.asAdmin, s.input);
    expect(before.publication).toMatchObject({ unpublishedAt: null, unpublishedBy: null });

    await unpublishReportCards(s.asAdmin, s.input);

    const { publication, publicationHistory } = await classReportCards(s.asAdmin, s.input);
    expect(publication).toBeNull();
    expect(publicationHistory).toHaveLength(1);
    expect(publicationHistory[0]).toMatchObject({
      publishedBy: "Amina Office",
      publishedAt: new Date("2027-01-05T09:00:00+04:00"),
      unpublishedBy: "Amina Office",
      unpublishedAt: new Date("2027-01-09T10:30:00+04:00"),
    });
  });

  test("Mark writes, maximum and weight, and remarks are accepted again, and Students no longer see the card", async () => {
    const s = await published();
    await unpublishReportCards(s.asAdmin, s.input);

    await saveMarks(s.asSara, { assessmentId: s.assessmentId, marks: [{ studentId: s.aisha, mark: 9 }] });
    await updateAssessment(s.asSara, { assessmentId: s.assessmentId, maxMarks: 10, weight: 2 });
    await saveSubjectRemark(s.asSara, {
      classSubjectId: s.math7A.id,
      termId: s.term1.id,
      studentId: s.aisha,
      remark: "Corrected.",
    });
    expect(await studentReportCards(s.app.as({ role: "student", userId: s.aisha }), { studentId: s.aisha })).toEqual([]);
  });

  test("Publishing again gives the Student the corrected card, and both Publishes are on record", async () => {
    const s = await published();
    await unpublishReportCards(s.asAdmin, s.input);
    await saveMarks(s.asSara, { assessmentId: s.assessmentId, marks: [{ studentId: s.aisha, mark: 9 }] });
    await publishReportCards(s.asAdmin, s.input);

    const [card] = await studentReportCards(s.app.as({ role: "student", userId: s.aisha }), { studentId: s.aisha });
    expect(card.overallPercent).toBe(90);
    const { publicationHistory } = await classReportCards(s.asAdmin, s.input);
    expect(publicationHistory.map((p) => p.unpublishedAt === null)).toEqual([true, false]);
  });
});

describe("a Published Report Card stays what the Student was given", () => {
  /** 7-A with a Grading Scale, Aisha at 80% and Bilal at 50%, Published with rank on. */
  async function publishedWithRank() {
    const s = await yearEndSchool();
    await setGradingScale(s.asAdmin, {
      gradeId: s.grade7.id,
      passMark: 50,
      bands: [
        { minPercent: 0, label: "Developing" },
        { minPercent: 75, label: "Strong" },
      ],
    });
    await setRankEnabled(s.asAdmin, true);
    await marked(s, s.math7A.id, { [s.aisha]: 8, [s.bilal]: 5 });
    const { term1, term2 } = await terms(s);
    const input = { classId: s.class7A.id, termId: term1.id };
    await publishReportCards(s.asAdmin, input);
    const asAisha = s.app.as({ role: "student", userId: s.aisha });
    return { ...s, term1, term2, input, asAisha };
  }

  test("a new Grading Scale doesn't change its labels", async () => {
    const s = await publishedWithRank();
    await setGradingScale(s.asAdmin, { gradeId: s.grade7.id, passMark: 90, bands: [{ minPercent: 0, label: "Redone" }] });

    const [card] = await studentReportCards(s.asAisha, { studentId: s.aisha });
    expect(card.grades[0]).toMatchObject({ label: "Strong", passed: true });
    const preview = await classReportCards(s.asAdmin, s.input);
    expect(preview.cards.find((c) => c.studentId === s.aisha)?.grades[0].label).toBe("Strong");
  });

  test("switching rank off doesn't take it off the card", async () => {
    const s = await publishedWithRank();
    await setRankEnabled(s.asAdmin, false);

    const [card] = await studentReportCards(s.asAisha, { studentId: s.aisha });
    expect(card).toMatchObject({ rank: 1, rankShown: true });
    expect((await classReportCards(s.asAdmin, s.input)).rankEnabled).toBe(true);
  });

  test("a new Subject Teacher doesn't change who the card names", async () => {
    const s = await publishedWithRank();
    await reassignSubjectTeacher(s.asAdmin, { classSubjectId: s.math7A.id, teacherId: s.omar.userId });

    const [card] = await studentReportCards(s.asAisha, { studentId: s.aisha });
    expect(card.grades[0].teacher).toBe("Sara");
  });

  test("renaming the Term keeps the Publication, and it still freezes the Term", async () => {
    const s = await publishedWithRank();
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

    const { terms: renamed, publication } = await classReportCards(s.asAdmin, { classId: s.class7A.id });
    expect(renamed[0].name).toBe("Autumn");
    expect(publication).not.toBeNull();
    const { id } = await createAssessment(s.asSara, quiz(s.math7A.id, { date: "2026-11-01" }));
    await expect(saveMarks(s.asSara, { assessmentId: id, marks: [{ studentId: s.aisha, mark: 9 }] })).rejects.toThrow(
      ReportCardsPublished,
    );
    const [card] = await studentReportCards(s.asAisha, { studentId: s.aisha });
    expect(card.term.name).toBe("Term 1");
  });

  test("moving a Published Term's dates is refused until it's unpublished", async () => {
    const s = await publishedWithRank();
    const moved = {
      id: s.year.id,
      name: "2026-2027",
      startDate: "2026-09-01",
      endDate: "2027-06-30",
      terms: [
        { name: "Term 1", startDate: "2026-09-01", endDate: "2027-01-15" },
        { name: "Term 2", startDate: "2027-01-16", endDate: "2027-06-30" },
      ],
    };
    await expect(updateAcademicYear(s.asAdmin, moved)).rejects.toThrow(ReportCardsPublished);

    await unpublishReportCards(s.asAdmin, s.input);
    await updateAcademicYear(s.asAdmin, moved);
  });

  describe("an Enrollment change that would change whose Report Card it is, is refused", () => {
    test("moving a Student out of the Published Class on a date up to the Term's last day", async () => {
      const s = await publishedWithRank();
      await expect(
        moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-12-31" }),
      ).rejects.toThrow(ReportCardsPublished);

      await unpublishReportCards(s.asAdmin, s.input);
      await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-12-31" });
    });

    test("moving after the Term's last day is fine: she was still in the Class on it", async () => {
      const s = await publishedWithRank();
      await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2027-01-01" });
      const [card] = await studentReportCards(s.asAisha, { studentId: s.aisha });
      expect(card.issuingClass.name).toBe("7-A");
    });

    test("moving a Student into the Published Class", async () => {
      const s = await publishedWithRank();
      const { studentId } = await s.newStudent("Dana Saleh", "S-77");
      await enrollStudent(s.asAdmin, { studentId, classId: s.class7B.id, startDate: "2026-09-01" });
      await expect(moveStudent(s.asAdmin, { studentId, classId: s.class7A.id, date: "2026-11-01" })).rejects.toThrow(
        ReportCardsPublished,
      );
    });

    test("enrolling a Student in the Published Class during the Term, though not after it", async () => {
      const s = await publishedWithRank();
      const { studentId } = await s.newStudent("Dana Saleh", "S-77");
      await expect(
        enrollStudent(s.asAdmin, { studentId, classId: s.class7A.id, startDate: "2026-11-01" }),
      ).rejects.toThrow(ReportCardsPublished);
      await enrollStudent(s.asAdmin, { studentId, classId: s.class7A.id, startDate: "2027-01-01" });
    });

    test("a Leaving Student's early last day, though not one on the Term's last day", async () => {
      const s = await publishedWithRank();
      await expect(
        promoteClass(s.asAdmin, {
          classId: s.class7A.id,
          leaving: [{ studentId: s.aisha, lastDay: "2026-12-30" }, { studentId: s.bilal }],
        }),
      ).rejects.toThrow(ReportCardsPublished);
      await promoteClass(s.asAdmin, {
        classId: s.class7A.id,
        leaving: [{ studentId: s.aisha, lastDay: "2026-12-31" }, { studentId: s.bilal }],
      });
    });
  });

  test("a Publication on the year's last Term doesn't get in the way of Promotion", async () => {
    const s = await assessmentSchool();
    await marked(s, s.math7A.id, { [s.aisha]: 8 }, "2027-02-01");
    const { term2 } = await terms(s);
    await publishReportCards(s.asAdmin, { classId: s.class7A.id, termId: term2.id });
    await promoteClass(s.asAdmin, { classId: s.class7A.id, leaving: [{ studentId: s.aisha }, { studentId: s.bilal }] });
  });
});

describe("Publish against writes in flight", () => {
  test("Publish waits for a Mark save in flight, so the Published card has that Mark", async () => {
    const s = await assessmentSchool();
    const assessmentId = await marked(s, s.math7A.id, { [s.aisha]: 1 });
    const { term1 } = await terms(s);
    const db = s.app.deps.db;

    // Holding the Mark's row stops a save at its write, past every check it makes. No
    // layer command can pause there, so this is the one place a test touches a table.
    let release = () => {};
    const released = new Promise<void>((resolve) => (release = resolve));
    const { promise: rowHeld, resolve: rowIsHeld } = Promise.withResolvers<void>();
    const holder = db.transaction(async (tx) => {
      await tx.execute(sql`select 1 from mark where assessment_id = ${assessmentId} for update`);
      rowIsHeld();
      await released;
    });
    await rowHeld;
    const waitingOnLocks = async () => {
      const { rows } = await db.execute(
        sql`select count(*)::int as n from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock'`,
      );
      return rows[0].n as number;
    };
    const until = async (done: () => Promise<boolean>) => {
      while (!(await done())) await new Promise((resolve) => setTimeout(resolve, 5));
    };

    const save = saveMarks(s.asSara, { assessmentId, marks: [{ studentId: s.aisha, mark: 9 }] });
    await until(async () => (await waitingOnLocks()) >= 1);

    let published = false;
    const publish = publishReportCards(s.asAdmin, { classId: s.class7A.id, termId: term1.id }).then(() => {
      published = true;
    });
    await until(async () => published || (await waitingOnLocks()) >= 2);
    release();
    await Promise.all([holder, save, publish]);

    const [card] = await studentReportCards(s.asAdmin, { studentId: s.aisha });
    expect(card.grades[0].percent).toBe(90);
  });
});

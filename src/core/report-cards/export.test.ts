import { describe, expect, test } from "vitest";
import { createAssessment } from "../assessments/assessments";
import { type MarkValue, saveMarks } from "../assessments/marks";
import { assessmentSchool, quiz } from "../assessments/test-assessments";
import { enrollStudent } from "../enrollment/enrollment";
import { AccessDenied, NotFound } from "../errors";
import { updateAcademicYear } from "../school/academic-year";
import { registerStudent } from "../students/register-student";
import { classReportCardExport, studentReportCardExport } from "./export";
import { publishReportCards, studentReportCards, unpublishReportCards } from "./publish";
import { setRankEnabled } from "./rank-setting";
import { classReportCards } from "./report-cards";

type School = Awaited<ReturnType<typeof assessmentSchool>>;

async function marked(s: School, classSubjectId: number, marks: Record<string, MarkValue>) {
  const { id } = await createAssessment(s.asSara, quiz(classSubjectId));
  await saveMarks(s.asSara, {
    assessmentId: id,
    marks: Object.entries(marks).map(([studentId, mark]) => ({ studentId, mark })),
  });
}

/** 7-A with Aisha on 80% and Bilal on 50%, and Term 1 of the fixture's year. */
async function markedClass() {
  const s = await assessmentSchool();
  await marked(s, s.math7A.id, { [s.aisha]: 8, [s.bilal]: 5 });
  const { terms } = await classReportCards(s.asAdmin, { classId: s.class7A.id });
  const input = { classId: s.class7A.id, termId: terms[0].id };
  return { s, input, asAisha: s.app.as({ role: "student", userId: s.aisha }), asBilal: s.app.as({ role: "student", userId: s.bilal }) };
}

/** Marked and Published, with the id of Aisha's Published Report Card. */
async function publishedClass() {
  const school = await markedClass();
  await publishReportCards(school.s.asAdmin, school.input);
  const [card] = await studentReportCards(school.asAisha, { studentId: school.s.aisha });
  return { ...school, publicationId: card.publicationId };
}

describe("A Student's Published Report Card to download", () => {
  test("a Student gets their own Published Report Card, with the figures they see on screen", async () => {
    const { s, asAisha, publicationId } = await publishedClass();

    const { cards, fileName } = await studentReportCardExport(asAisha, { studentId: s.aisha, publicationId });

    expect(cards).toHaveLength(1);
    expect(cards[0].card).toMatchObject({
      studentId: s.aisha,
      name: "Aisha Rahman",
      studentNumber: "S-1",
      overallPercent: 80,
      issuingClass: { name: "7-A" },
      classTeacher: "Huda",
    });
    expect(cards[0].card.grades.map((g) => [g.subject, g.percent])).toEqual([["Math", 80]]);
    expect(cards[0].term).toEqual({ name: "Term 1", academicYear: "2026-2027" });
    expect(cards[0].publishedAt).toEqual(new Date("2026-10-20T08:00:00+04:00"));
    expect(fileName).toBe("report-card-S-1-2026-12-31.pdf");
  });

  test("a Student is refused another Student's Report Card, however the request names it", async () => {
    const { s, asBilal, publicationId } = await publishedClass();

    await expect(studentReportCardExport(asBilal, { studentId: s.aisha, publicationId })).rejects.toThrow(AccessDenied);

    // Bilal's own id with a Publication of which he has a card gives him his own, never Aisha's.
    const own = await studentReportCardExport(asBilal, { studentId: s.bilal, publicationId });
    expect(own.cards.map((c) => c.card.name)).toEqual(["Bilal Khan"]);
  });

  test("a Teacher is refused a Student's Report Card, even their Class Teacher", async () => {
    const { s, publicationId } = await publishedClass();
    await expect(studentReportCardExport(s.asHuda, { studentId: s.aisha, publicationId })).rejects.toThrow(AccessDenied);
  });

  test("the Admin can download any Student's Published Report Card", async () => {
    const { s, publicationId } = await publishedClass();
    const { cards } = await studentReportCardExport(s.asAdmin, { studentId: s.aisha, publicationId });
    expect(cards[0].card.name).toBe("Aisha Rahman");
  });

  test("once unpublished, the Report Card can't be downloaded", async () => {
    const { s, input, asAisha, publicationId } = await publishedClass();
    await unpublishReportCards(s.asAdmin, input);

    await expect(studentReportCardExport(asAisha, { studentId: s.aisha, publicationId })).rejects.toThrow(NotFound);
  });

  test("a Publication with no card for this Student, or an id that isn't one, is not found", async () => {
    const { s, asAisha, publicationId } = await publishedClass();

    await expect(studentReportCardExport(asAisha, { studentId: s.aisha, publicationId: publicationId + 1 })).rejects.toThrow(NotFound);
    await expect(studentReportCardExport(asAisha, { studentId: s.aisha, publicationId: Number.NaN })).rejects.toThrow(NotFound);
  });

  test("a file name stays safe to send whatever the Student Number holds", async () => {
    const { s, input } = await markedClass();
    const { studentId } = await registerStudent(s.asAdmin, {
      name: "Dana Saleh",
      studentNumber: 'ع"7\\x',
      dateOfBirth: "2013-04-12",
      nationalId: "784-S-77",
      guardianContact: "Guardian",
      admissionDate: "2026-08-25",
    });
    await enrollStudent(s.asAdmin, { studentId, classId: s.class7A.id, startDate: "2026-09-01" });
    await publishReportCards(s.asAdmin, input);
    const [card] = await studentReportCards(s.asAdmin, { studentId });

    const { fileName } = await studentReportCardExport(s.asAdmin, { studentId, publicationId: card.publicationId });

    expect(fileName).toBe("report-card-7-X-2026-12-31.pdf");
  });
});

describe("The Admin's export of a Class's Report Cards", () => {
  test("the whole Class's Published Report Cards, by name, as Students see them", async () => {
    const { s, input } = await publishedClass();

    const { cards, fileName } = await classReportCardExport(s.asAdmin, input);

    expect(cards.map((c) => [c.card.name, c.card.overallPercent])).toEqual([
      ["Aisha Rahman", 80],
      ["Bilal Khan", 50],
    ]);
    expect(cards.every((c) => c.publishedAt !== null)).toBe(true);
    expect(fileName).toBe("report-cards-7-A-2026-12-31.pdf");
  });

  test("one Student's Report Card from the Class", async () => {
    const { s, input } = await publishedClass();

    const { cards, fileName } = await classReportCardExport(s.asAdmin, { ...input, studentId: s.bilal });

    expect(cards.map((c) => c.card.name)).toEqual(["Bilal Khan"]);
    expect(fileName).toBe("report-card-S-2-2026-12-31.pdf");
  });

  test("only the Admin can export from a Class", async () => {
    const { s, input, asAisha } = await publishedClass();

    await expect(classReportCardExport(s.asHuda, input)).rejects.toThrow(AccessDenied);
    await expect(classReportCardExport(asAisha, { ...input, studentId: s.aisha })).rejects.toThrow(AccessDenied);
  });

  test("before Publish the export is a draft of the live figures", async () => {
    const { s, input } = await markedClass();

    const { cards } = await classReportCardExport(s.asAdmin, input);

    expect(cards.map((c) => [c.card.name, c.card.overallPercent, c.publishedAt])).toEqual([
      ["Aisha Rahman", 80, null],
      ["Bilal Khan", 50, null],
    ]);
  });

  test("one Student's draft still ranks them within the whole Issuing Class", async () => {
    const { s, input } = await markedClass();
    await setRankEnabled(s.asAdmin, true);

    const { cards } = await classReportCardExport(s.asAdmin, { ...input, studentId: s.bilal });

    expect(cards[0].rankShown).toBe(true);
    expect(cards[0].card.rank).toBe(2);
  });

  test("a Published export keeps what was Published when the rank switch and Term name change", async () => {
    const { s, input, asAisha, publicationId } = await publishedClass();
    await setRankEnabled(s.asAdmin, true);
    await updateAcademicYear(s.asAdmin, {
      id: s.year.id,
      name: "2026-2027",
      startDate: "2026-09-01",
      endDate: "2027-06-30",
      terms: [
        { name: "Autumn", startDate: "2026-09-01", endDate: "2026-12-31" },
        { name: "Term 2", startDate: "2027-01-01", endDate: "2027-06-30" },
      ],
    });
    const { terms } = await classReportCards(s.asAdmin, { classId: input.classId });

    const fromClass = await classReportCardExport(s.asAdmin, { classId: input.classId, termId: terms[0].id, studentId: s.aisha });
    const forStudent = await studentReportCardExport(asAisha, { studentId: s.aisha, publicationId });

    expect(fromClass.cards[0].term).toEqual({ name: "Term 1", academicYear: "2026-2027" });
    expect(fromClass.cards[0].rankShown).toBe(false);
    expect(fromClass.cards[0]).toEqual(forStudent.cards[0]);
  });

  test("a Student the Class doesn't issue a Report Card to, or a Class with none, is not found", async () => {
    const { s, input } = await markedClass();
    const { terms } = await classReportCards(s.asAdmin, { classId: s.class7B.id });

    await expect(classReportCardExport(s.asAdmin, { ...input, studentId: "nobody" })).rejects.toThrow(NotFound);
    await expect(classReportCardExport(s.asAdmin, { classId: s.class7B.id, termId: terms[0].id })).rejects.toThrow(NotFound);
  });
});

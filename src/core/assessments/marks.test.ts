import { describe, expect, test } from "vitest";
import { createTeacher } from "../accounts/create-teacher";
import { reassignSubjectTeacher } from "../classes/class-subjects";
import { enrollStudent, moveStudent } from "../enrollment/enrollment";
import { AccessDenied, InvalidInput } from "../errors";
import { getStudentProfile } from "../students/student-profile";
import { registerStudent } from "../students/register-student";
import { createAssessment, listAssessments } from "./assessments";
import { marksGrid, saveMarks, studentAssessmentHistory } from "./marks";
import { assessmentSchool, quiz } from "./test-assessments";

const gridNames = (grid: Awaited<ReturnType<typeof marksGrid>>) => grid.rows.map((r) => r.name);
const gridMarks = (grid: Awaited<ReturnType<typeof marksGrid>>) => grid.rows.map((r) => [r.name, r.mark]);

describe("the marks grid", () => {
  test("lists exactly the Students enrolled in the Class on the Assessment's date", async () => {
    const s = await assessmentSchool();
    // Bilal moves to 7-B on 2026-10-01; Carla joins 7-A on 2026-10-01.
    await moveStudent(s.asAdmin, { studentId: s.bilal, classId: s.class7B.id, date: "2026-10-01" });
    const { studentId: carla } = await registerStudent(s.asAdmin, {
      name: "Carla Diaz",
      studentNumber: "S-3",
      dateOfBirth: "2013-01-01",
      nationalId: "784-S-3",
      guardianContact: "Guardian",
      admissionDate: "2026-09-30",
    });
    await enrollStudent(s.asAdmin, { studentId: carla, classId: s.class7A.id, startDate: "2026-10-01" });

    const before = await createAssessment(s.asSara, quiz(s.math7A.id, { date: "2026-09-30" }));
    const after = await createAssessment(s.asSara, quiz(s.math7A.id, { date: "2026-10-01" }));

    expect(gridNames(await marksGrid(s.asSara, { assessmentId: before.id }))).toEqual(["Aisha Rahman", "Bilal Khan"]);
    expect(gridNames(await marksGrid(s.asSara, { assessmentId: after.id }))).toEqual(["Aisha Rahman", "Carla Diaz"]);
    // A Student not on the roster that day can't be given a Mark.
    await expect(
      saveMarks(s.asSara, { assessmentId: after.id, marks: [{ studentId: s.bilal, mark: 5 }] }),
    ).rejects.toThrow(expect.objectContaining({ messageKey: "errors.markStudentNotOnRoster" }));
  });

  test("a Mark is a raw score, Absent or Exempt, and can be changed or cleared", async () => {
    const s = await assessmentSchool();
    const a = await createAssessment(s.asSara, quiz(s.math7A.id, { maxMarks: 10 }));
    await saveMarks(s.asSara, {
      assessmentId: a.id,
      marks: [
        { studentId: s.aisha, mark: 7.5 },
        { studentId: s.bilal, mark: "absent" },
      ],
    });
    expect(gridMarks(await marksGrid(s.asSara, { assessmentId: a.id }))).toEqual([
      ["Aisha Rahman", 7.5],
      ["Bilal Khan", "absent"],
    ]);

    await saveMarks(s.asSara, {
      assessmentId: a.id,
      marks: [
        { studentId: s.aisha, mark: null },
        { studentId: s.bilal, mark: "exempt" },
      ],
    });
    expect(gridMarks(await marksGrid(s.asSara, { assessmentId: a.id }))).toEqual([
      ["Aisha Rahman", null],
      ["Bilal Khan", "exempt"],
    ]);
  });

  test("out-of-range scores are refused and nothing in that save is kept", async () => {
    const s = await assessmentSchool();
    const a = await createAssessment(s.asSara, quiz(s.math7A.id, { maxMarks: 10 }));
    for (const bad of [-1, 10.5, Number.NaN, 3.333]) {
      await expect(
        saveMarks(s.asSara, {
          assessmentId: a.id,
          marks: [
            { studentId: s.aisha, mark: 8 },
            { studentId: s.bilal, mark: bad },
          ],
        }),
      ).rejects.toThrow(expect.objectContaining({ messageKey: "errors.markOutOfRange" }));
    }
    await expect(
      saveMarks(s.asSara, { assessmentId: a.id, marks: [{ studentId: s.aisha, mark: "late" as "absent" }] }),
    ).rejects.toThrow(InvalidInput);
    expect(gridMarks(await marksGrid(s.asSara, { assessmentId: a.id }))).toEqual([
      ["Aisha Rahman", null],
      ["Bilal Khan", null],
    ]);
    // 0 and the maximum are both fine.
    await saveMarks(s.asSara, {
      assessmentId: a.id,
      marks: [
        { studentId: s.aisha, mark: 0 },
        { studentId: s.bilal, mark: 10 },
      ],
    });
    expect(gridMarks(await marksGrid(s.asSara, { assessmentId: a.id }))).toEqual([
      ["Aisha Rahman", 0],
      ["Bilal Khan", 10],
    ]);
  });

  test("only the Subject Teacher enters Marks; the Class Teacher and the Admin see the grid read-only", async () => {
    const s = await assessmentSchool();
    const a = await createAssessment(s.asSara, quiz(s.math7A.id));
    const entry = { assessmentId: a.id, marks: [{ studentId: s.aisha, mark: 5 }] };
    await expect(saveMarks(s.asHuda, entry)).rejects.toThrow(AccessDenied);
    await expect(saveMarks(s.asAdmin, entry)).rejects.toThrow(AccessDenied);
    await expect(saveMarks(s.asOmar, entry)).rejects.toThrow(AccessDenied);

    expect((await marksGrid(s.asSara, { assessmentId: a.id })).canEnterMarks).toBe(true);
    expect((await marksGrid(s.asHuda, { assessmentId: a.id })).canEnterMarks).toBe(false);
    expect((await marksGrid(s.asAdmin, { assessmentId: a.id })).canEnterMarks).toBe(false);
    await expect(marksGrid(s.asOmar, { assessmentId: a.id })).rejects.toThrow(AccessDenied);
    await expect(
      marksGrid(s.app.as({ role: "student", userId: s.aisha }), { assessmentId: a.id }),
    ).rejects.toThrow(AccessDenied);
  });
});

const historyOf = (rows: Awaited<ReturnType<typeof studentAssessmentHistory>>) =>
  rows.map((r) => [r.class, r.subject, r.date, r.mark]);

describe("the Aisha scenario: Marks follow the Class Subject, not the Student's Class today", () => {
  test("after Aisha moves from 7-A to 7-B mid-Term, 7-A's Subject Teacher still sees and edits her Mark on an earlier 7-A Assessment", async () => {
    const s = await assessmentSchool();
    // 7-B's Math goes to Omar, so Sara teaches nothing in 7-B and isn't one of Aisha's Teachers after the move.
    await reassignSubjectTeacher(s.asAdmin, { classSubjectId: s.math7B.id, teacherId: s.omar.userId });
    const before = await createAssessment(s.asSara, quiz(s.math7A.id, { date: "2026-09-20" }));
    await saveMarks(s.asSara, { assessmentId: before.id, marks: [{ studentId: s.aisha, mark: 6 }] });

    // Week 6: Aisha moves to 7-B. Today (2026-10-20) she is in 7-B.
    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-10-05" });
    const after = await createAssessment(s.asSara, quiz(s.math7A.id, { date: "2026-10-15" }));

    // Sara's profile access follows today's Class, so she loses Aisha's profile...
    await expect(getStudentProfile(s.asSara, { studentId: s.aisha })).rejects.toThrow(AccessDenied);
    // ...but 7-A's grid for the earlier Assessment still lists Aisha, who was on the roster that day.
    const grid = await marksGrid(s.asSara, { assessmentId: before.id });
    expect(gridMarks(grid)).toEqual([
      ["Aisha Rahman", 6],
      ["Bilal Khan", null],
    ]);
    expect(grid.canEnterMarks).toBe(true);
    // Sara can still edit Aisha's Mark there.
    await saveMarks(s.asSara, { assessmentId: before.id, marks: [{ studentId: s.aisha, mark: 9 }] });
    expect(gridMarks(await marksGrid(s.asSara, { assessmentId: before.id }))[0]).toEqual(["Aisha Rahman", 9]);
    // The 7-A Assessment after the move doesn't list her.
    expect(gridNames(await marksGrid(s.asSara, { assessmentId: after.id }))).toEqual(["Bilal Khan"]);
    // And Sara sees the Mark in Aisha's Assessment history (only the Class Subjects Sara can see).
    expect(historyOf(await studentAssessmentHistory(s.asSara, { studentId: s.aisha }))).toEqual([
      ["7-A", "Math", "2026-09-20", 9],
    ]);
  });

  test("Aisha's history shows Assessments from both Classes to her; each Teacher sees only the Class Subjects they can see", async () => {
    const s = await assessmentSchool();
    await reassignSubjectTeacher(s.asAdmin, { classSubjectId: s.math7B.id, teacherId: s.omar.userId });
    const math7A = await createAssessment(s.asSara, quiz(s.math7A.id, { date: "2026-09-20", maxMarks: 20 }));
    await saveMarks(s.asSara, { assessmentId: math7A.id, marks: [{ studentId: s.aisha, mark: 15 }] });
    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-10-05" });
    const math7B = await createAssessment(s.asOmar, quiz(s.math7B.id, { date: "2026-10-12" }));
    await saveMarks(s.asOmar, { assessmentId: math7B.id, marks: [{ studentId: s.aisha, mark: "absent" }] });
    // An Assessment with no Mark for her yet still appears, as not entered.
    await createAssessment(s.asHuda, { ...quiz(s.science7B.id, { date: "2026-10-14" }), type: "assignment" });

    const asAisha = s.app.as({ role: "student", userId: s.aisha });
    const mine = await studentAssessmentHistory(asAisha, { studentId: s.aisha });
    expect(historyOf(mine)).toEqual([
      ["7-B", "Science", "2026-10-14", null],
      ["7-B", "Math", "2026-10-12", "absent"],
      ["7-A", "Math", "2026-09-20", 15],
    ]);
    expect(mine.map((r) => [r.term, r.percent])).toEqual([
      ["Term 1", null],
      ["Term 1", 0],
      ["Term 1", 75],
    ]);
    // The Admin sees everything.
    expect(await studentAssessmentHistory(s.asAdmin, { studentId: s.aisha })).toHaveLength(3);
    // Omar: Class Teacher and Math teacher of 7-B, so all of 7-B and nothing of 7-A.
    expect(historyOf(await studentAssessmentHistory(s.asOmar, { studentId: s.aisha })).map((r) => r[0])).toEqual([
      "7-B",
      "7-B",
    ]);
    // Huda: Class Teacher of 7-A (sees its Math) and Science teacher of 7-B.
    expect(historyOf(await studentAssessmentHistory(s.asHuda, { studentId: s.aisha })).map((r) => r[1])).toEqual([
      "Science",
      "Math",
    ]);
    // Another Student is refused, and so is a Teacher who never taught her.
    await expect(
      studentAssessmentHistory(s.app.as({ role: "student", userId: s.bilal }), { studentId: s.aisha }),
    ).rejects.toThrow(AccessDenied);
    const { teacherId: zaid } = await createTeacher(s.asAdmin, { name: "Zaid", email: "zaid@school.test" });
    await expect(
      studentAssessmentHistory(s.app.as({ role: "teacher", userId: zaid }), { studentId: s.aisha }),
    ).rejects.toThrow(AccessDenied);
  });

  test("the Class Teacher sees every Class Subject's Marks for their Class", async () => {
    const s = await assessmentSchool();
    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-09-02" });
    const science = await createAssessment(s.asHuda, quiz(s.science7B.id, { date: "2026-09-20" }));
    await saveMarks(s.asHuda, { assessmentId: science.id, marks: [{ studentId: s.aisha, mark: 4 }] });
    // Omar is 7-B's Class Teacher but doesn't teach Science.
    expect((await listAssessments(s.asOmar, { classSubjectId: s.science7B.id }))[0].stats.highest).toBe(4);
    expect(gridMarks(await marksGrid(s.asOmar, { assessmentId: science.id }))).toEqual([["Aisha Rahman", 4]]);
  });
});

describe("saving a whole Class", () => {
  test("a 40-Student grid saves in one go in under a second", async () => {
    const s = await assessmentSchool();
    const ids = await Promise.all(
      Array.from({ length: 38 }, async (_, i) => {
        const { studentId } = await registerStudent(s.asAdmin, {
          name: `Student ${String(i + 3).padStart(2, "0")}`,
          studentNumber: `B-${i + 3}`,
          dateOfBirth: "2013-01-01",
          nationalId: `784-B-${i + 3}`,
          guardianContact: "Guardian",
          admissionDate: "2026-08-25",
        });
        await enrollStudent(s.asAdmin, { studentId, classId: s.class7A.id, startDate: "2026-09-01" });
        return studentId;
      }),
    );
    const everyone = [s.aisha, s.bilal, ...ids];
    const a = await createAssessment(s.asSara, quiz(s.math7A.id, { maxMarks: 40 }));
    const marks = everyone.map((studentId, i) => ({ studentId, mark: i === 0 ? ("absent" as const) : i }));

    const started = performance.now();
    await saveMarks(s.asSara, { assessmentId: a.id, marks });
    const elapsed = performance.now() - started;

    expect(elapsed).toBeLessThan(1000);
    const grid = await marksGrid(s.asSara, { assessmentId: a.id });
    expect(grid.rows).toHaveLength(40);
    expect(grid.stats).toEqual({ counted: 40, average: 19.5, highest: 39, lowest: 0 });
  });
});

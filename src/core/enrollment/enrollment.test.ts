import { describe, expect, it } from "vitest";
import { createClass } from "../classes/classes";
import { AccessDenied, AlreadyEnrolled, InvalidInput, NotEnrolled, NotFound } from "../errors";
import { createGrade } from "../school/catalogue";
import { classRoster, enrollStudent, moveStudent } from "./enrollment";
import { enrollmentSchool, names } from "./test-enrollment";

describe("Enrollment", () => {
  it("an Admin enrolls a Student in a Class from a date, and they are on its roster from that date", async () => {
    const s = await enrollmentSchool();

    await enrollStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7A.id, startDate: "2026-09-07" });

    expect(names(await classRoster(s.asAdmin, { classId: s.class7A.id, date: "2026-09-06" }))).toEqual([]);
    expect(names(await classRoster(s.asAdmin, { classId: s.class7A.id, date: "2026-09-07" }))).toEqual([
      "Aisha Rahman",
    ]);
  });

  it("a Student with an open Enrollment cannot be enrolled in a second Class", async () => {
    const s = await enrollmentSchool();
    await enrollStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7A.id, startDate: "2026-09-07" });

    await expect(
      enrollStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, startDate: "2026-10-01" }),
    ).rejects.toThrow(AlreadyEnrolled);
    expect(names(await classRoster(s.asAdmin, { classId: s.class7B.id, date: "2026-10-01" }))).toEqual([]);
  });

  it("an Enrollment must start inside the Class's Academic Year, for a registered Student and an existing Class", async () => {
    const s = await enrollmentSchool();
    const enroll = (classId: number, startDate: string) =>
      enrollStudent(s.asAdmin, { studentId: s.aisha, classId, startDate });

    await expect(enroll(s.class7A.id, "2026-08-31")).rejects.toThrow(InvalidInput);
    await expect(enroll(s.class7A.id, "2027-07-01")).rejects.toThrow(InvalidInput);
    await expect(enroll(s.class7A.id, "not a date")).rejects.toThrow(InvalidInput);
    await expect(enroll(9999, "2026-09-01")).rejects.toThrow(NotFound);
    await expect(
      enrollStudent(s.asAdmin, { studentId: "nobody", classId: s.class7A.id, startDate: "2026-09-01" }),
    ).rejects.toThrow(NotFound);

    await enroll(s.class7A.id, "2026-09-01");
    expect(names(await classRoster(s.asAdmin, { classId: s.class7A.id, date: "2027-06-30" }))).toEqual([
      "Aisha Rahman",
    ]);
  });

  it("only an Admin enrolls and moves Students", async () => {
    const s = await enrollmentSchool();

    await expect(
      enrollStudent(s.app.as(s.huda), { studentId: s.aisha, classId: s.class7A.id, startDate: "2026-09-01" }),
    ).rejects.toThrow(AccessDenied);
    await enrollStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7A.id, startDate: "2026-09-01" });
    await expect(
      moveStudent(s.app.as(s.huda), { studentId: s.aisha, classId: s.class7B.id, date: "2026-10-01" }),
    ).rejects.toThrow(AccessDenied);
    await expect(
      moveStudent(s.app.as({ role: "student", userId: s.aisha }), {
        studentId: s.aisha,
        classId: s.class7B.id,
        date: "2026-10-01",
      }),
    ).rejects.toThrow(AccessDenied);
  });

  it("Aisha moves from 7-A to 7-B in week 6: each roster has her on exactly its own dates", async () => {
    const s = await enrollmentSchool();
    await enrollStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7A.id, startDate: "2026-09-01" });
    await enrollStudent(s.asAdmin, { studentId: s.bilal, classId: s.class7A.id, startDate: "2026-09-01" });

    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-10-06" });

    const roster = async (classId: number, date: string) => names(await classRoster(s.asAdmin, { classId, date }));
    expect(await roster(s.class7A.id, "2026-10-05")).toEqual(["Aisha Rahman", "Bilal Khan"]);
    expect(await roster(s.class7B.id, "2026-10-05")).toEqual([]);
    expect(await roster(s.class7A.id, "2026-10-06")).toEqual(["Bilal Khan"]);
    expect(await roster(s.class7B.id, "2026-10-06")).toEqual(["Aisha Rahman"]);
  });

  it("a Student can only be moved if enrolled, to another Class of the same Grade and year, after their start date", async () => {
    const s = await enrollmentSchool();
    const grade8 = await createGrade(s.asAdmin, { name: "Grade 8" });
    const class8A = await createClass(s.asAdmin, {
      academicYearId: s.year.id,
      gradeId: grade8.id,
      name: "8-A",
      classTeacherId: s.sara.userId,
    });
    const move = (classId: number, date: string) => moveStudent(s.asAdmin, { studentId: s.aisha, classId, date });

    await expect(move(s.class7B.id, "2026-10-06")).rejects.toThrow(NotEnrolled);
    await enrollStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7A.id, startDate: "2026-09-07" });
    await expect(move(class8A.id, "2026-10-06")).rejects.toThrow(InvalidInput);
    await expect(move(s.class7A.id, "2026-10-06")).rejects.toThrow(InvalidInput);
    await expect(move(s.class7B.id, "2026-09-07")).rejects.toThrow(InvalidInput);
    await expect(move(s.class7B.id, "2027-07-01")).rejects.toThrow(InvalidInput);

    await move(s.class7B.id, "2026-09-08");
    expect(names(await classRoster(s.asAdmin, { classId: s.class7A.id, date: "2026-09-07" }))).toEqual([
      "Aisha Rahman",
    ]);
  });
});

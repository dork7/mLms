import { describe, expect, it } from "vitest";
import type { Actor } from "../context";
import { AccessDenied } from "../errors";
import { getStudentPhoto, getStudentProfile } from "../students/student-profile";
import { classRoster, enrollStudent, moveStudent } from "./enrollment";
import { listMyStudents, type MyStudentsFilter } from "./my-students";
import { enrollmentSchool, names } from "./test-enrollment";

describe("A Teacher's Students", () => {
  it("a Class roster is seen by the Admin, its Class Teacher and its Subject Teachers, and refused to others", async () => {
    const s = await enrollmentSchool();
    await enrollStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7A.id, startDate: "2026-09-01" });
    const roster7A = (actor = s.admin) => classRoster(s.app.as(actor), { classId: s.class7A.id, date: "2026-09-01" });

    expect(names(await roster7A(s.huda))).toEqual(["Aisha Rahman"]);
    expect(names(await roster7A(s.sara))).toEqual(["Aisha Rahman"]);
    await expect(roster7A(s.omar)).rejects.toThrow(AccessDenied);
    await expect(roster7A({ role: "student", userId: s.aisha })).rejects.toThrow(AccessDenied);
  });

  it("My Students lists today's Students of the Teacher's Class Subjects, filtered by Class or Class Subject", async () => {
    const s = await enrollmentSchool();
    await enrollStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7A.id, startDate: "2026-09-01" });
    await enrollStudent(s.asAdmin, { studentId: s.bilal, classId: s.class7B.id, startDate: "2026-09-01" });
    const mine = async (teacher: Actor, filter: MyStudentsFilter = {}) =>
      (await listMyStudents(s.app.as(teacher), filter)).map((r) => `${r.name} (${r.class})`);

    expect(await mine(s.sara)).toEqual(["Aisha Rahman (7-A)", "Bilal Khan (7-B)"]);
    expect(await mine(s.sara, { classId: s.class7B.id })).toEqual(["Bilal Khan (7-B)"]);
    expect(await mine(s.sara, { classSubjectId: s.math7A.id })).toEqual(["Aisha Rahman (7-A)"]);
    expect(await mine(s.sara, { classId: s.class7B.id, classSubjectId: s.math7A.id })).toEqual([]);
    expect(await mine(s.omar, { classSubjectId: s.math7A.id })).toEqual([]);
    const [bilal] = await listMyStudents(s.app.as(s.huda), { classSubjectId: s.science7B.id });
    expect(bilal.classSubjects.map((cs) => cs.subject)).toEqual(["Science"]);
  });

  it("My Students follows a move: the Student is listed under their Class on today's date", async () => {
    const s = await enrollmentSchool();
    await enrollStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7A.id, startDate: "2026-09-01" });
    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-10-06" });
    const omarsStudents = async () => names(await listMyStudents(s.app.as(s.omar), {}));

    s.app.clock.set("2026-10-05T08:00:00+04:00");
    expect(await omarsStudents()).toEqual([]);
    s.app.clock.set("2026-10-06T08:00:00+04:00");
    expect(await omarsStudents()).toEqual(["Aisha Rahman"]);
  });

  it("a Student's profile is seen by their Teachers while enrolled in the Teachers' Class, and refused to other Teachers", async () => {
    const s = await enrollmentSchool();
    const profileAs = (actor: Actor) => getStudentProfile(s.app.as(actor), { studentId: s.aisha });
    const photoAs = (actor: Actor) => getStudentPhoto(s.app.as(actor), { studentId: s.aisha });

    // Not enrolled yet: no Teacher of hers.
    await expect(profileAs(s.huda)).rejects.toThrow(AccessDenied);

    await enrollStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7A.id, startDate: "2026-09-01" });
    expect((await profileAs(s.huda)).name).toBe("Aisha Rahman"); // 7-A's Class Teacher
    expect((await profileAs(s.sara)).name).toBe("Aisha Rahman"); // 7-A's Math Teacher
    expect(await photoAs(s.sara)).toBeNull();
    await expect(profileAs(s.omar)).rejects.toThrow(AccessDenied);
    await expect(photoAs(s.omar)).rejects.toThrow(AccessDenied);

    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-10-06" });
    s.app.clock.set("2026-10-06T08:00:00+04:00");
    expect((await profileAs(s.omar)).name).toBe("Aisha Rahman"); // 7-B's Class Teacher now
  });

  it("the Student profile shows the Enrollment history to the Admin, the Student's Teachers and the Student", async () => {
    const s = await enrollmentSchool({ now: "2026-10-06T08:00:00+04:00" });
    await enrollStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7A.id, startDate: "2026-09-01" });
    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-10-06" });
    const history = async (actor: Actor) =>
      (await getStudentProfile(s.app.as(actor), { studentId: s.aisha })).enrollments.map((e) => [
        e.class,
        e.startDate,
        e.endDate,
      ]);
    const expected = [
      ["7-A", "2026-09-01", "2026-10-05"],
      ["7-B", "2026-10-06", null],
    ];

    expect(await history(s.admin)).toEqual(expected);
    expect(await history(s.omar)).toEqual(expected);
    expect(await history({ role: "student", userId: s.aisha })).toEqual(expected);
    await expect(history({ role: "student", userId: s.bilal })).rejects.toThrow(AccessDenied);
  });

  it("My Students is a Teacher's list", async () => {
    const s = await enrollmentSchool();
    await expect(listMyStudents(s.asAdmin, {})).rejects.toThrow(AccessDenied);
    await expect(listMyStudents(s.app.as({ role: "student", userId: s.aisha }), {})).rejects.toThrow(AccessDenied);
  });
});

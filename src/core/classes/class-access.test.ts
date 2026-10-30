// The access policy for Classes and Class Subjects, seen from each Teacher.
//
//   7-A: Class Teacher Huda. Math taught by Omar, Science taught by Sara.
//   7-B: Class Teacher Sara. Math taught by Omar.
import { describe, expect, it } from "vitest";
import type { Actor } from "../context";
import { AccessDenied, NotFound } from "../errors";
import { createClass, getClass, listMyClasses } from "./classes";
import { createClassSubject, getClassSubject, listClassSubjects, listMyClassSubjects } from "./class-subjects";
import { school } from "./test-school";

async function twoClasses() {
  const s = await school();
  const { asAdmin, year, grade7, math, science, huda, omar, sara } = s;
  const newClass = (name: string, teacher: Actor) =>
    createClass(asAdmin, { academicYearId: year.id, gradeId: grade7.id, name, classTeacherId: teacher.userId });
  const teach = (classId: number, subjectId: number, teacher: Actor) =>
    createClassSubject(asAdmin, { classId, subjectId, teacherId: teacher.userId });

  const class7A = await newClass("7-A", huda);
  const class7B = await newClass("7-B", sara);
  const math7A = await teach(class7A.id, math.id, omar);
  const science7A = await teach(class7A.id, science.id, sara);
  const math7B = await teach(class7B.id, math.id, omar);
  return { ...s, class7A, class7B, math7A, science7A, math7B };
}

const ids = (rows: { id: number }[]) => rows.map((r) => r.id);

describe("Access to Classes and Class Subjects", () => {
  it("a Teacher's list of Class Subjects contains only their own", async () => {
    const { app, huda, omar, sara, math7A, math7B, science7A } = await twoClasses();

    expect(ids(await listMyClassSubjects(app.as(omar)))).toEqual([math7A.id, math7B.id]);
    expect(ids(await listMyClassSubjects(app.as(sara)))).toEqual([science7A.id]);
    expect(await listMyClassSubjects(app.as(huda))).toEqual([]);
  });

  it("a Teacher is refused another Teacher's Class Subject", async () => {
    const { app, omar, sara, math7A, math7B } = await twoClasses();

    expect(await getClassSubject(app.as(omar), { classSubjectId: math7A.id })).toMatchObject({
      id: math7A.id,
      subject: "Math",
      class: "7-A",
      teacher: "Omar",
    });
    await expect(getClassSubject(app.as(sara), { classSubjectId: math7A.id })).rejects.toThrow(AccessDenied);
    // Sara is 7-B's Class Teacher, but that gives her nothing in 7-A.
    expect(await getClassSubject(app.as(sara), { classSubjectId: math7B.id })).toMatchObject({ id: math7B.id });
  });

  it("a Class Teacher can see every Class Subject of their Class, and only their Class", async () => {
    const { app, huda, class7A, class7B, math7A, science7A, math7B } = await twoClasses();

    expect(ids(await listClassSubjects(app.as(huda), { classId: class7A.id }))).toEqual([math7A.id, science7A.id]);
    expect(await getClassSubject(app.as(huda), { classSubjectId: science7A.id })).toMatchObject({
      id: science7A.id,
    });
    await expect(listClassSubjects(app.as(huda), { classId: class7B.id })).rejects.toThrow(AccessDenied);
    await expect(getClassSubject(app.as(huda), { classSubjectId: math7B.id })).rejects.toThrow(AccessDenied);
  });

  it("a Class Teacher opens their own Class, and is refused any other", async () => {
    const { app, asAdmin, huda, omar, class7A, class7B } = await twoClasses();

    expect(await getClass(app.as(huda), { classId: class7A.id })).toMatchObject({
      id: class7A.id,
      name: "7-A",
      classTeacher: "Huda",
    });
    await expect(getClass(app.as(huda), { classId: class7B.id })).rejects.toThrow(AccessDenied);
    await expect(getClass(app.as(omar), { classId: class7A.id })).rejects.toThrow(AccessDenied);
    expect(await getClass(asAdmin, { classId: class7B.id })).toMatchObject({ id: class7B.id });
  });

  it("a Subject Teacher who isn't the Class Teacher can't list the whole Class's Class Subjects", async () => {
    const { app, omar, class7A } = await twoClasses();

    await expect(listClassSubjects(app.as(omar), { classId: class7A.id })).rejects.toThrow(AccessDenied);
  });

  it("a Teacher sees the Classes they are Class Teacher of", async () => {
    const { app, huda, omar, class7A } = await twoClasses();

    expect(await listMyClasses(app.as(huda))).toEqual([
      expect.objectContaining({ id: class7A.id, name: "7-A", grade: "Grade 7", academicYear: "2026-2027" }),
    ]);
    expect(await listMyClasses(app.as(omar))).toEqual([]);
  });

  it("the Admin can see every Class Subject", async () => {
    const { asAdmin, math7B } = await twoClasses();

    expect(await getClassSubject(asAdmin, { classSubjectId: math7B.id })).toMatchObject({ id: math7B.id });
  });

  it("a Class or Class Subject that doesn't exist is not found", async () => {
    const { asAdmin } = await twoClasses();

    await expect(getClassSubject(asAdmin, { classSubjectId: 999 })).rejects.toThrow(NotFound);
    await expect(getClass(asAdmin, { classId: Number.NaN })).rejects.toThrow(NotFound);
    await expect(listClassSubjects(asAdmin, { classId: Number.NaN })).rejects.toThrow(NotFound);
  });

  it("a Student is refused every Class Subject", async () => {
    const { app, class7A, math7A } = await twoClasses();
    const student: Actor = { role: "student", userId: "some-student" };

    await expect(getClassSubject(app.as(student), { classSubjectId: math7A.id })).rejects.toThrow(AccessDenied);
    await expect(listClassSubjects(app.as(student), { classId: class7A.id })).rejects.toThrow(AccessDenied);
    await expect(listMyClassSubjects(app.as(student))).rejects.toThrow(AccessDenied);
  });
});

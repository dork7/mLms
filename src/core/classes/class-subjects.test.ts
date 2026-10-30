import { describe, expect, it } from "vitest";
import { AccessDenied, ClassSubjectExists, InvalidInput, NotFound } from "../errors";
import { createClass } from "./classes";
import { createClassSubject, listClassSubjects, reassignSubjectTeacher } from "./class-subjects";
import { school } from "./test-school";

async function schoolWithClass7A() {
  const s = await school();
  const class7A = await createClass(s.asAdmin, {
    academicYearId: s.year.id,
    gradeId: s.grade7.id,
    name: "7-A",
    classTeacherId: s.huda.userId,
  });
  return { ...s, class7A };
}

describe("Class Subjects", () => {
  it("the Admin creates a Class Subject with a Subject Teacher and reassigns the Teacher", async () => {
    const { asAdmin, class7A, math, omar, sara, year, grade7 } = await schoolWithClass7A();

    const { id } = await createClassSubject(asAdmin, {
      classId: class7A.id,
      subjectId: math.id,
      teacherId: omar.userId,
    });
    expect(await listClassSubjects(asAdmin, { classId: class7A.id })).toEqual([
      {
        id,
        classId: class7A.id,
        class: "7-A",
        gradeId: grade7.id,
        grade: "Grade 7",
        academicYearId: year.id,
        academicYear: "2026-2027",
        subjectId: math.id,
        subject: "Math",
        teacherId: omar.userId,
        teacher: "Omar",
      },
    ]);

    await reassignSubjectTeacher(asAdmin, { classSubjectId: id, teacherId: sara.userId });

    const [reassigned] = await listClassSubjects(asAdmin, { classId: class7A.id });
    expect(reassigned).toMatchObject({ id, teacherId: sara.userId, teacher: "Sara" });
  });

  it("a Class has each Subject only once", async () => {
    const { asAdmin, class7A, math, omar, sara } = await schoolWithClass7A();
    await createClassSubject(asAdmin, { classId: class7A.id, subjectId: math.id, teacherId: omar.userId });

    await expect(
      createClassSubject(asAdmin, { classId: class7A.id, subjectId: math.id, teacherId: sara.userId }),
    ).rejects.toThrow(ClassSubjectExists);
  });

  it("the Subject Teacher must be a Teacher, when created and when reassigned", async () => {
    const { asAdmin, admin, class7A, math, omar } = await schoolWithClass7A();
    const notATeacher = new InvalidInput("errors.notATeacher");

    await expect(
      createClassSubject(asAdmin, { classId: class7A.id, subjectId: math.id, teacherId: admin.userId }),
    ).rejects.toThrow(notATeacher);
    const { id } = await createClassSubject(asAdmin, { classId: class7A.id, subjectId: math.id, teacherId: omar.userId });
    await expect(reassignSubjectTeacher(asAdmin, { classSubjectId: id, teacherId: admin.userId })).rejects.toThrow(
      notATeacher,
    );
  });

  it("reassigning a Class Subject that doesn't exist is refused", async () => {
    const { asAdmin, omar } = await schoolWithClass7A();

    await expect(reassignSubjectTeacher(asAdmin, { classSubjectId: 999, teacherId: omar.userId })).rejects.toThrow(
      NotFound,
    );
  });

  it("a Teacher is refused creating or reassigning a Class Subject", async () => {
    const { app, asAdmin, class7A, math, omar } = await schoolWithClass7A();
    const { id } = await createClassSubject(asAdmin, { classId: class7A.id, subjectId: math.id, teacherId: omar.userId });

    await expect(
      createClassSubject(app.as(omar), { classId: class7A.id, subjectId: math.id, teacherId: omar.userId }),
    ).rejects.toThrow(AccessDenied);
    await expect(reassignSubjectTeacher(app.as(omar), { classSubjectId: id, teacherId: omar.userId })).rejects.toThrow(
      AccessDenied,
    );
  });
});

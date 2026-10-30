// Test fixture for Enrollment: the `school()` fixture plus two Grade 7 Classes,
// their Class Subjects and two registered (not yet enrolled) Students.
//
//   7-A: Class Teacher Huda. Math taught by Sara.
//   7-B: Class Teacher Omar. Math taught by Sara, Science taught by Huda.
import { createClassSubject } from "../classes/class-subjects";
import { createClass } from "../classes/classes";
import { school } from "../classes/test-school";
import { registerStudent } from "../students/register-student";

export async function enrollmentSchool(opts: { now?: string } = {}) {
  const s = await school(opts);
  const newClass = (name: string, classTeacherId: string) =>
    createClass(s.asAdmin, { academicYearId: s.year.id, gradeId: s.grade7.id, name, classTeacherId });
  const class7A = await newClass("7-A", s.huda.userId);
  const class7B = await newClass("7-B", s.omar.userId);
  const newClassSubject = (classId: number, subjectId: number, teacherId: string) =>
    createClassSubject(s.asAdmin, { classId, subjectId, teacherId });
  const math7A = await newClassSubject(class7A.id, s.math.id, s.sara.userId);
  const math7B = await newClassSubject(class7B.id, s.math.id, s.sara.userId);
  const science7B = await newClassSubject(class7B.id, s.science.id, s.huda.userId);

  const student = async (name: string, studentNumber: string) => {
    const { studentId } = await registerStudent(s.asAdmin, {
      name,
      studentNumber,
      dateOfBirth: "2013-04-12",
      nationalId: `784-${studentNumber}`,
      guardianContact: "Guardian, +971 50 000 0000",
      admissionDate: "2026-08-25",
    });
    return studentId;
  };
  const aisha = await student("Aisha Rahman", "S-1");
  const bilal = await student("Bilal Khan", "S-2");
  return { ...s, class7A, class7B, math7A, math7B, science7B, aisha, bilal };
}

export const names = (rows: { name: string }[]) => rows.map((r) => r.name);

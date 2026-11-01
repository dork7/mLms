// Test fixture for year end: `assessmentSchool()` (year 2026-2027, Aisha and Bilal in
// 7-A, today 2026-10-20) plus the new Academic Year it rolls into.
//
//   Grade 8 follows Grade 7 in the Admin's order.
//   2027-2028: 8-A and 8-B (Grade 8, Class Teacher Omar), 7-A next (Grade 7).
import { assessmentSchool } from "../assessments/test-assessments";
import { createClass } from "../classes/classes";
import { createAcademicYear } from "../school/academic-year";
import { createGrade, setGradeOrder } from "../school/catalogue";
import { registerStudent } from "../students/register-student";

export async function yearEndSchool() {
  const s = await assessmentSchool();
  const nextYear = await createAcademicYear(s.asAdmin, {
    name: "2027-2028",
    startDate: "2027-09-01",
    endDate: "2028-06-30",
    terms: [{ name: "Term 1", startDate: "2027-09-01", endDate: "2028-06-30" }],
  });
  const grade8 = await createGrade(s.asAdmin, { name: "Grade 8" });
  await setGradeOrder(s.asAdmin, { gradeId: s.grade7.id, order: 7 });
  await setGradeOrder(s.asAdmin, { gradeId: grade8.id, order: 8 });
  const newClass = (name: string, gradeId: number) =>
    createClass(s.asAdmin, { academicYearId: nextYear.id, gradeId, name, classTeacherId: s.omar.userId });
  const class8A = await newClass("8-A", grade8.id);
  const class8B = await newClass("8-B", grade8.id);
  const next7A = await newClass("7-A next", s.grade7.id);
  const newStudent = (name: string, studentNumber: string) =>
    registerStudent(s.asAdmin, {
      name,
      studentNumber,
      dateOfBirth: "2013-04-12",
      nationalId: `784-${studentNumber}`,
      guardianContact: "Guardian, +971 50 000 0000",
      admissionDate: "2026-08-25",
    });
  return { ...s, nextYear, grade8, class8A, class8B, next7A, newStudent };
}

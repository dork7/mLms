// Test fixture for Fees: `enrollmentSchool()` (today 2026-10-01) with Aisha in 7-A,
// Bilal in 7-B, Chen in Grade 8's 8-A, and Dana registered but in no Class.
//
//   7-A: Class Teacher Huda. 7-B: Class Teacher Omar. 8-A: Class Teacher Sara.
import { createClass } from "../classes/classes";
import { enrollStudent } from "../enrollment/enrollment";
import { enrollmentSchool } from "../enrollment/test-enrollment";
import { createGrade } from "../school/catalogue";
import { registerStudent } from "../students/register-student";
import { createFee } from "./fees";

export async function feesSchool() {
  const s = await enrollmentSchool({ now: "2026-10-01T08:00:00+04:00" });
  const grade8 = await createGrade(s.asAdmin, { name: "Grade 8" });
  const class8A = await createClass(s.asAdmin, {
    academicYearId: s.year.id,
    gradeId: grade8.id,
    name: "8-A",
    classTeacherId: s.sara.userId,
  });
  const student = async (name: string, studentNumber: string) =>
    (
      await registerStudent(s.asAdmin, {
        name,
        studentNumber,
        dateOfBirth: "2012-01-01",
        nationalId: `784-${studentNumber}`,
        guardianContact: "Guardian, +971 50 000 0000",
        admissionDate: "2026-08-25",
      })
    ).studentId;
  const chen = await student("Chen Li", "S-3");
  const dana = await student("Dana Saleh", "S-4");
  const enroll = (studentId: string, classId: number) =>
    enrollStudent(s.asAdmin, { studentId, classId, startDate: "2026-09-01" });
  await enroll(s.aisha, s.class7A.id);
  await enroll(s.bilal, s.class7B.id);
  await enroll(chen, class8A.id);

  const asStudent = (studentId: string) => s.app.as({ role: "student", userId: studentId });
  const newFee = (over: Partial<{ name: string; amount: string; dueDate: string }> = {}) =>
    createFee(s.asAdmin, { name: "Term 1 Tuition", amount: "1,000", dueDate: "2026-10-15", ...over });
  return { ...s, grade8, class8A, chen, dana, asStudent, newFee };
}

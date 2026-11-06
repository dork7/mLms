// Test fixture for Assessments and Marks: `enrollmentSchool()` with today = 2026-10-20,
// the year split into two Terms, and Aisha and Bilal enrolled in 7-A from day one.
//
//   Term 1: 2026-09-01..2026-12-31, Term 2: 2027-01-01..2027-06-30.
//   7-A: Class Teacher Huda. Math taught by Sara.
//   7-B: Class Teacher Omar. Math taught by Sara, Science taught by Huda.
import { enrollStudent } from "../enrollment/enrollment";
import { enrollmentSchool } from "../enrollment/test-enrollment";
import { updateAcademicYear } from "../school/academic-year";

export async function assessmentSchool() {
  const s = await enrollmentSchool({ now: "2026-10-20T08:00:00+04:00" });
  await updateAcademicYear(s.asAdmin, {
    id: s.year.id,
    name: "2026-2027",
    startDate: "2026-09-01",
    endDate: "2027-06-30",
    terms: [
      { name: "Term 1", startDate: "2026-09-01", endDate: "2026-12-31" },
      { name: "Term 2", startDate: "2027-01-01", endDate: "2027-06-30" },
    ],
  });
  await enrollStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7A.id, startDate: "2026-09-01" });
  await enrollStudent(s.asAdmin, { studentId: s.bilal, classId: s.class7A.id, startDate: "2026-09-01" });
  return { ...s, asSara: s.app.as(s.sara), asHuda: s.app.as(s.huda), asOmar: s.app.as(s.omar) };
}

/** A 10-mark quiz with weight 1 on 2026-09-20, unless overridden. */
export const quiz = (
  classSubjectId: number,
  over: Partial<{ date: string; maxMarks: number; weight: number }> = {},
) => ({ classSubjectId, type: "quiz" as const, date: "2026-09-20", maxMarks: 10, weight: 1, ...over });

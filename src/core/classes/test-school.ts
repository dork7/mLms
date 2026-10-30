// Test fixture: a school with an Academic Year, Grade 7, two Subjects and three
// Teachers, all set up through layer commands. Used by the Class tests.
import { testApp } from "../../../test/test-app";
import { createTeacher } from "../accounts/create-teacher";
import type { Actor } from "../context";
import { createAcademicYear } from "../school/academic-year";
import { createGrade, createSubject } from "../school/catalogue";

export async function school(opts: { now?: string } = {}) {
  const app = await testApp(opts);
  const admin = await app.seedAdmin();
  const asAdmin = app.as(admin);
  const year = await createAcademicYear(asAdmin, {
    name: "2026-2027",
    startDate: "2026-09-01",
    endDate: "2027-06-30",
    terms: [{ name: "Term 1", startDate: "2026-09-01", endDate: "2027-06-30" }],
  });
  const grade7 = await createGrade(asAdmin, { name: "Grade 7" });
  const math = await createSubject(asAdmin, { name: "Math" });
  const science = await createSubject(asAdmin, { name: "Science" });
  const teacher = async (name: string, email: string): Promise<Actor> => {
    const { teacherId } = await createTeacher(asAdmin, { name, email });
    return { role: "teacher", userId: teacherId };
  };
  const huda = await teacher("Huda", "huda@school.test");
  const omar = await teacher("Omar", "omar@school.test");
  const sara = await teacher("Sara", "sara@school.test");
  return { app, admin, asAdmin, year, grade7, math, science, huda, omar, sara };
}

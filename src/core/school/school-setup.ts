// Everything the Admin's setup screens show, in one Admin-only query.
import { requireAdmin } from "../access";
import type { Ctx } from "../context";
import { type AcademicYear, listAcademicYears } from "./academic-year";
import { type GradeInOrder, listGrades, listGradesInOrder, listRooms, listSubjects, type Named } from "./catalogue";
import { getPeriodsPerDay } from "./periods";

export type SchoolSetup = {
  academicYears: AcademicYear[];
  grades: Named[];
  /** The same Grades in the Admin's order, with that order. */
  gradesInOrder: GradeInOrder[];
  subjects: Named[];
  rooms: Named[];
  periodsPerDay: number | null;
};

export async function getSchoolSetup(ctx: Ctx): Promise<SchoolSetup> {
  requireAdmin(ctx.actor);

  const [academicYears, grades, gradesInOrder, subjects, rooms, periodsPerDay] = await Promise.all([
    listAcademicYears(ctx),
    listGrades(ctx),
    listGradesInOrder(ctx),
    listSubjects(ctx),
    listRooms(ctx),
    getPeriodsPerDay(ctx),
  ]);
  return { academicYears, grades, gradesInOrder, subjects, rooms, periodsPerDay };
}

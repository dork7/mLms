// Everything the Admin's setup screens show, in one Admin-only query.
import { requireAdmin } from "../access";
import type { Ctx } from "../context";
import { type AcademicYear, listAcademicYears } from "./academic-year";
import { listGrades, listRooms, listSubjects, type Named } from "./catalogue";
import { getPeriodsPerDay } from "./periods";

export type SchoolSetup = {
  academicYears: AcademicYear[];
  grades: Named[];
  subjects: Named[];
  rooms: Named[];
  periodsPerDay: number | null;
};

export async function getSchoolSetup(ctx: Ctx): Promise<SchoolSetup> {
  requireAdmin(ctx.actor);

  const [academicYears, grades, subjects, rooms, periodsPerDay] = await Promise.all([
    listAcademicYears(ctx),
    listGrades(ctx),
    listSubjects(ctx),
    listRooms(ctx),
    getPeriodsPerDay(ctx),
  ]);
  return { academicYears, grades, subjects, rooms, periodsPerDay };
}

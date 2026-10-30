// Academic Years and their Terms. Terms must cover their Academic Year exactly:
// the first starts on the year's first day, each next one starts the day after
// the previous one ends, and the last ends on the year's last day.
// All ranges are inclusive calendar dates (YYYY-MM-DD).
import { and, asc, desc, eq, gte, lte, ne, sql } from "drizzle-orm";
import { academicYear, term } from "@/db/schema";
import { requireAdmin, requireRole } from "../access";
import type { Ctx } from "../context";
import {
  AcademicYearsOverlap,
  isUniqueViolation,
  NameTaken,
  NotFound,
  TermsDoNotCoverYear,
} from "../errors";

export type TermInput = { name: string; startDate: string; endDate: string };
export type CreateAcademicYearInput = {
  name: string;
  startDate: string;
  endDate: string;
  terms: TermInput[];
};

export type Term = {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  academicYearId: number;
  academicYear: string;
};

export async function createAcademicYear(
  ctx: Ctx,
  input: CreateAcademicYearInput,
): Promise<{ id: number }> {
  requireAdmin(ctx.actor);
  return saveAcademicYear(ctx, null, input);
}

/** Renames an Academic Year, moves its dates and replaces its Terms (same rules as creating). */
export async function updateAcademicYear(
  ctx: Ctx,
  input: CreateAcademicYearInput & { id: number },
): Promise<{ id: number }> {
  requireAdmin(ctx.actor);
  return saveAcademicYear(ctx, input.id, input);
}

async function saveAcademicYear(
  ctx: Ctx,
  id: number | null,
  input: CreateAcademicYearInput,
): Promise<{ id: number }> {
  if (!termsCoverYear(input)) throw new TermsDoNotCoverYear();
  const values = { name: input.name.trim(), startDate: input.startDate, endDate: input.endDate };

  try {
    return await ctx.db.transaction(async (tx) => {
      // Serialise year writes so two concurrent overlapping years can't both pass the check.
      await tx.execute(sql`LOCK TABLE ${academicYear} IN SHARE ROW EXCLUSIVE MODE`);
      const overlapping = await tx
        .select({ id: academicYear.id })
        .from(academicYear)
        .where(
          and(
            lte(academicYear.startDate, input.endDate),
            gte(academicYear.endDate, input.startDate),
            id === null ? undefined : ne(academicYear.id, id),
          ),
        );
      if (overlapping.length > 0) throw new AcademicYearsOverlap();

      let year: { id: number } | undefined;
      if (id === null) {
        [year] = await tx.insert(academicYear).values(values).returning({ id: academicYear.id });
      } else {
        [year] = await tx
          .update(academicYear)
          .set(values)
          .where(eq(academicYear.id, id))
          .returning({ id: academicYear.id });
        if (!year) throw new NotFound();
        await tx.delete(term).where(eq(term.academicYearId, id));
      }
      const yearId = year.id;
      await tx.insert(term).values(
        input.terms.map((t) => ({ ...t, name: t.name.trim(), academicYearId: yearId })),
      );
      return year;
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new NameTaken();
    throw err;
  }
}

export type AcademicYear = {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  terms: { id: number; name: string; startDate: string; endDate: string }[];
};

/** Every Academic Year, newest first, each with its Terms in date order. Admin-only (setup screens). */
export async function listAcademicYears(ctx: Ctx): Promise<AcademicYear[]> {
  requireAdmin(ctx.actor);

  const years = await ctx.db.select().from(academicYear).orderBy(desc(academicYear.startDate));
  const terms = await ctx.db.select().from(term).orderBy(asc(term.startDate));
  return years.map((y) => ({
    ...y,
    terms: terms
      .filter((t) => t.academicYearId === y.id)
      .map(({ id, name, startDate, endDate }) => ({ id, name, startDate, endDate })),
  }));
}

/** The Term a date falls in, or null if no Academic Year covers it. */
export async function termOn(ctx: Ctx, date: string): Promise<Term | null> {
  requireRole(ctx.actor, "admin", "teacher", "student");

  const [found] = await ctx.db
    .select({
      id: term.id,
      name: term.name,
      startDate: term.startDate,
      endDate: term.endDate,
      academicYearId: term.academicYearId,
      academicYear: academicYear.name,
    })
    .from(term)
    .innerJoin(academicYear, eq(term.academicYearId, academicYear.id))
    .where(and(lte(term.startDate, date), gte(term.endDate, date)));
  return found ?? null;
}

function termsCoverYear(year: CreateAcademicYearInput): boolean {
  if (year.startDate > year.endDate || year.terms.length === 0) return false;
  const terms = [...year.terms].sort((a, b) => a.startDate.localeCompare(b.startDate));
  if (terms.some((t) => t.startDate > t.endDate)) return false;
  if (terms[0].startDate !== year.startDate) return false;
  if (terms[terms.length - 1].endDate !== year.endDate) return false;
  return terms.every((t, i) => i === 0 || t.startDate === nextDay(terms[i - 1].endDate));
}

/** "2026-12-31" -> "2027-01-01". */
function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

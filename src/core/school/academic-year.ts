// Academic Years and their Terms. Terms must cover their Academic Year exactly:
// the first starts on the year's first day, each next one starts the day after
// the previous one ends, and the last ends on the year's last day.
// All ranges are inclusive calendar dates (YYYY-MM-DD).
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { academicYear, term } from "@/db/schema";
import { requireAdmin, requireRole } from "../access";
import type { Ctx } from "../context";
import { AcademicYearsOverlap, isUniqueViolation, NameTaken, TermsDoNotCoverYear } from "../errors";

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
  if (!termsCoverYear(input)) throw new TermsDoNotCoverYear();

  try {
    return await ctx.db.transaction(async (tx) => {
      // Serialise year creation so two concurrent overlapping years can't both pass the check.
      await tx.execute(sql`LOCK TABLE ${academicYear} IN SHARE ROW EXCLUSIVE MODE`);
      const overlapping = await tx
        .select({ id: academicYear.id })
        .from(academicYear)
        .where(and(lte(academicYear.startDate, input.endDate), gte(academicYear.endDate, input.startDate)));
      if (overlapping.length > 0) throw new AcademicYearsOverlap();

      const [year] = await tx
        .insert(academicYear)
        .values({ name: input.name.trim(), startDate: input.startDate, endDate: input.endDate })
        .returning({ id: academicYear.id });
      await tx.insert(term).values(
        input.terms.map((t) => ({ ...t, name: t.name.trim(), academicYearId: year.id })),
      );
      return year;
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new NameTaken();
    throw err;
  }
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

// Grading Scales: each Grade's percentage bands and pass mark. A band is its lowest
// percentage and label, and runs up to the next band's start, so bands can't leave
// gaps or overlap. The lowest must start at 0 so every percentage gets a label. An open
// year's Term Grades read the live Scale; Closing keeps a snapshot for the Closed year's.
import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { academicYear, closedYearScale, grade, gradingBand, gradingScale, schoolClass } from "@/db/schema";
import { requireAdmin, requireRole } from "../access";
import type { Ctx } from "../context";
import type { Tx } from "../enrollment/enrollment";
import { InvalidInput, NotFound } from "../errors";
import { hasAtMostTwoDecimals } from "../assessments/mark-values";
import type { GradingScale } from "./term-grade-rules";

export type { GradingScale } from "./term-grade-rules";

/** Defines a Grade's Grading Scale, replacing the one it has. Admin only. */
export async function setGradingScale(ctx: Ctx, input: { gradeId: number } & GradingScale): Promise<void> {
  requireAdmin(ctx.actor);
  if (!Number.isSafeInteger(input.gradeId)) throw new NotFound();
  const scale = validScale(input);
  await ctx.db.transaction(async (tx) => {
    const [found] = await tx.select({ id: grade.id }).from(grade).where(eq(grade.id, input.gradeId));
    if (!found) throw new NotFound();
    // The upsert holds the row's lock, so two concurrent saves can't mix their bands.
    await tx
      .insert(gradingScale)
      .values({ gradeId: input.gradeId, passMark: scale.passMark })
      .onConflictDoUpdate({ target: gradingScale.gradeId, set: { passMark: sql`excluded.pass_mark` } });
    await tx.delete(gradingBand).where(eq(gradingBand.gradeId, input.gradeId));
    await tx.insert(gradingBand).values(scale.bands.map((b) => ({ gradeId: input.gradeId, ...b })));
  });
}

/** A Grade's Grading Scale, or null if it has none yet. Staff can read it. */
export async function getGradingScale(ctx: Ctx, input: { gradeId: number }): Promise<GradingScale | null> {
  requireRole(ctx.actor, "admin", "teacher");
  if (!Number.isSafeInteger(input.gradeId)) throw new NotFound();
  return (await scalesFor(ctx.db, [input.gradeId])).get(input.gradeId) ?? null;
}

export type GradeScaleRow = { gradeId: number; grade: string; scale: GradingScale | null };

/** Every Grade with its Grading Scale, by Grade name. Admin only (the setup screen). */
export async function listGradingScales(ctx: Ctx): Promise<GradeScaleRow[]> {
  requireAdmin(ctx.actor);
  const grades = await ctx.db.select({ id: grade.id, name: grade.name }).from(grade).orderBy(asc(grade.name));
  const scales = await scalesFor(
    ctx.db,
    grades.map((g) => g.id),
  );
  return grades.map((g) => ({ gradeId: g.id, grade: g.name, scale: scales.get(g.id) ?? null }));
}

/** The Grading Scales of these Grades, with bands highest first. Grades with none are absent. */
export async function scalesFor(db: Db, gradeIds: number[]): Promise<Map<number, GradingScale>> {
  const scales = new Map<number, GradingScale>();
  if (gradeIds.length === 0) return scales;
  const rows = await db.select().from(gradingScale).where(inArray(gradingScale.gradeId, gradeIds));
  for (const r of rows) scales.set(r.gradeId, { passMark: r.passMark, bands: [] });
  const bands = await db
    .select()
    .from(gradingBand)
    .where(inArray(gradingBand.gradeId, gradeIds))
    .orderBy(desc(gradingBand.minPercent));
  for (const b of bands) scales.get(b.gradeId)?.bands.push({ minPercent: b.minPercent, label: b.label });
  return scales;
}

/**
 * Keeps each Grade's Scale as it stands now, for a year being Closed: the Grades with a
 * Class in that year, the only ones its Term Grades can read. One statement, so it can't
 * catch a concurrent `setGradingScale` halfway. Runs in Closing's transaction.
 */
export async function snapshotScalesForClosing(tx: Tx, academicYearId: number): Promise<void> {
  await tx.execute(sql`
    insert into ${closedYearScale} (academic_year_id, grade_id, pass_mark, bands)
    select ${academicYearId}::integer, s.grade_id, s.pass_mark,
      (select jsonb_agg(jsonb_build_object('minPercent', b.min_percent, 'label', b.label) order by b.min_percent desc)
       from ${gradingBand} b where b.grade_id = s.grade_id)
    from ${gradingScale} s
    where s.grade_id in (select c.grade_id from ${schoolClass} c where c.academic_year_id = ${academicYearId}::integer)
  `);
}

/** A Class, as far as which Grading Scale its Term Grades read. */
type ScaleOwner = { gradeId: number; academicYearId: number };

/**
 * Which Grading Scale a Term Grade reads, given its Issuing Class: in a Closed year the
 * snapshot taken at Closing, otherwise the Grade's live Scale. A Closed year never falls
 * back to the live Scale, so a Grade that had none at Closing stays without a label.
 */
export async function termGradeScales(
  db: Db,
  owners: Iterable<ScaleOwner | null | undefined>,
): Promise<(owner: ScaleOwner | null | undefined) => GradingScale | null> {
  const known = [...owners].filter((o) => o !== null && o !== undefined);
  const gradeIds = [...new Set(known.map((o) => o.gradeId))];
  const yearIds = [...new Set(known.map((o) => o.academicYearId))];
  if (known.length === 0) return () => null;

  const live = await scalesFor(db, gradeIds);
  const closedYears = await db
    .select({ id: academicYear.id })
    .from(academicYear)
    .where(and(inArray(academicYear.id, yearIds), isNotNull(academicYear.closedAt)));
  const closed = new Set(closedYears.map((y) => y.id));
  const snapshots =
    closed.size === 0
      ? []
      : await db
          .select()
          .from(closedYearScale)
          .where(and(inArray(closedYearScale.academicYearId, [...closed]), inArray(closedYearScale.gradeId, gradeIds)));
  const snapshot = new Map(
    snapshots.map((s) => [`${s.academicYearId}:${s.gradeId}`, { passMark: s.passMark, bands: s.bands }]),
  );

  return (owner) => {
    if (!owner) return null;
    if (closed.has(owner.academicYearId)) return snapshot.get(`${owner.academicYearId}:${owner.gradeId}`) ?? null;
    return live.get(owner.gradeId) ?? null;
  };
}

function validScale(input: GradingScale): GradingScale {
  if (!isPercent(input.passMark)) throw new InvalidInput("errors.gradingPassMarkInvalid");
  if (input.bands.length === 0) throw new InvalidInput("errors.gradingBandsRequired");
  const bands = input.bands.map((b) => ({ minPercent: b.minPercent, label: b.label.trim() }));
  if (bands.some((b) => b.label === "")) throw new InvalidInput("errors.gradingBandLabelRequired");
  if (bands.some((b) => !isPercent(b.minPercent))) throw new InvalidInput("errors.gradingBandPercentInvalid");
  const starts = bands.map((b) => b.minPercent);
  if (new Set(starts).size !== starts.length) throw new InvalidInput("errors.gradingBandsDuplicate");
  if (Math.min(...starts) !== 0) throw new InvalidInput("errors.gradingBandsMustStartAtZero");
  return { passMark: input.passMark, bands };
}

/** From 0 to 100 with at most two decimals (the columns are numeric(5,2)). */
function isPercent(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 100 && hasAtMostTwoDecimals(value);
}

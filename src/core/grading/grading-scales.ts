// Grading Scales: each Grade's percentage bands and pass mark. A band is its lowest
// percentage and label, and runs up to the next band's start, so bands can't leave
// gaps or overlap. The lowest must start at 0 so every percentage gets a label.
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { grade, gradingBand, gradingScale } from "@/db/schema";
import { requireAdmin, requireRole } from "../access";
import type { Ctx } from "../context";
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

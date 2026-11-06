// Grades, Subjects and Rooms: named lists the Admin maintains. Names are
// trimmed and unique within each list. Staff can read the lists.
import { asc, eq, sql } from "drizzle-orm";
import { grade, room, subject } from "@/db/schema";
import { requireAdmin, requireId, requireRole } from "../access";
import type { Ctx } from "../context";
import { InvalidInput, isUniqueViolation, NameTaken, NotFound } from "../errors";

export type Named = { id: number; name: string };

type NamedTable = typeof grade | typeof subject | typeof room;

function namedList(table: NamedTable) {
  return {
    async create(ctx: Ctx, input: { name: string }): Promise<Named> {
      requireAdmin(ctx.actor);
      return refuseDuplicate(async () => {
        const [row] = await ctx.db.insert(table).values({ name: input.name.trim() }).returning();
        return row;
      });
    },

    async rename(ctx: Ctx, input: { id: number; name: string }): Promise<Named> {
      requireAdmin(ctx.actor);
      return refuseDuplicate(async () => {
        const [row] = await ctx.db
          .update(table)
          .set({ name: input.name.trim() })
          .where(eq(table.id, input.id))
          .returning();
        if (!row) throw new NotFound();
        return row;
      });
    },

    async list(ctx: Ctx): Promise<Named[]> {
      requireRole(ctx.actor, "admin", "teacher");
      return ctx.db.select({ id: table.id, name: table.name }).from(table).orderBy(asc(table.name));
    },
  };
}

async function refuseDuplicate<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (err) {
    if (isUniqueViolation(err)) throw new NameTaken();
    throw err;
  }
}

/** How high a Grade's order can go. Far more than a school has Grades, and it fits the column. */
const MAX_GRADE_ORDER = 1000;

export type GradeInOrder = Named & { order: number | null };

/**
 * Sets a Grade's place in the Admin's order of Grades, which Promotion follows, or clears
 * it with null. Whole numbers from 1, each used by one Grade; the next Grade is the next
 * higher number, so gaps are fine. Admin only.
 */
export async function setGradeOrder(ctx: Ctx, input: { gradeId: number; order: number | null }): Promise<void> {
  requireAdmin(ctx.actor);
  requireId(input.gradeId);
  const { order } = input;
  if (order !== null && (!Number.isInteger(order) || order < 1 || order > MAX_GRADE_ORDER)) {
    throw new InvalidInput("errors.gradeOrderInvalid");
  }
  try {
    const rows = await ctx.db
      .update(grade)
      .set({ sortOrder: order })
      .where(eq(grade.id, input.gradeId))
      .returning({ id: grade.id });
    if (rows.length === 0) throw new NotFound();
  } catch (err) {
    if (isUniqueViolation(err)) throw new InvalidInput("errors.gradeOrderTaken");
    throw err;
  }
}

/** Every Grade in the Admin's order, then those with no order yet by name. Staff can read it. */
export async function listGradesInOrder(ctx: Ctx): Promise<GradeInOrder[]> {
  requireRole(ctx.actor, "admin", "teacher");
  return ctx.db
    .select({ id: grade.id, name: grade.name, order: grade.sortOrder })
    .from(grade)
    .orderBy(sql`${grade.sortOrder} asc nulls last`, asc(grade.name));
}

const grades = namedList(grade);
const subjects = namedList(subject);
const rooms = namedList(room);

export const createGrade = grades.create;
export const renameGrade = grades.rename;
export const listGrades = grades.list;

export const createSubject = subjects.create;
export const renameSubject = subjects.rename;
export const listSubjects = subjects.list;

export const createRoom = rooms.create;
export const renameRoom = rooms.rename;
export const listRooms = rooms.list;

// Grades, Subjects and Rooms: named lists the Admin maintains. Names are
// trimmed and unique within each list. Staff can read the lists.
import { asc, eq } from "drizzle-orm";
import { grade, room, subject } from "@/db/schema";
import { requireAdmin, requireRole } from "../access";
import type { Ctx } from "../context";
import { isUniqueViolation, NameTaken, NotFound } from "../errors";

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

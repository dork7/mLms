// The access policy: the one place that answers "may this actor do this?".
// Commands and queries call these guards first; the UI never decides access.
// Add new rules here (e.g. Students and Parents, Class rosters) as tickets need them.
//
// Classes and Class Subjects (spec, "Identity and access"):
//   - An Admin can see and act on everything.
//   - A Subject Teacher can see their own Class Subjects.
//   - A Class Teacher can also see every Class Subject of their Class.
//   - Students see no Class Subject (until a later ticket says otherwise).
import { eq } from "drizzle-orm";
import { classSubject, schoolClass } from "@/db/schema";
import type { Actor, Ctx, Role } from "./context";
import { AccessDenied, NotFound } from "./errors";

export function requireRole(actor: Actor, ...roles: Role[]): void {
  if (!roles.includes(actor.role)) throw new AccessDenied(`requires role ${roles.join(" or ")}`);
}

export function requireAdmin(actor: Actor): void {
  requireRole(actor, "admin");
}

/** The whole Class (every Class Subject in it): the Admin or the Class's Class Teacher. */
export async function requireCanSeeClass(ctx: Ctx, classId: number): Promise<void> {
  requireRole(ctx.actor, "admin", "teacher");
  requireId(classId);
  const [found] = await ctx.db
    .select({ classTeacherId: schoolClass.classTeacherId })
    .from(schoolClass)
    .where(eq(schoolClass.id, classId));
  if (!found) throw new NotFound();
  if (ctx.actor.role === "admin" || found.classTeacherId === ctx.actor.userId) return;
  throw new AccessDenied("not this Class's Class Teacher");
}

/** One Class Subject: the Admin, its Subject Teacher, or its Class's Class Teacher. */
export async function requireCanSeeClassSubject(ctx: Ctx, classSubjectId: number): Promise<void> {
  requireRole(ctx.actor, "admin", "teacher");
  requireId(classSubjectId);
  const [found] = await ctx.db
    .select({ teacherId: classSubject.teacherId, classTeacherId: schoolClass.classTeacherId })
    .from(classSubject)
    .innerJoin(schoolClass, eq(schoolClass.id, classSubject.classId))
    .where(eq(classSubject.id, classSubjectId));
  if (!found) throw new NotFound();
  const me = ctx.actor.userId;
  if (ctx.actor.role === "admin" || found.teacherId === me || found.classTeacherId === me) return;
  throw new AccessDenied("not this Class Subject's Teacher");
}

/**
 * Act on a Class Subject (log its Lessons, later enter its Marks): only its current
 * Subject Teacher. The Admin and the Class Teacher can see it but not act on it, so
 * records are attributed to the person who taught.
 */
export async function requireCanActOnClassSubject(ctx: Ctx, classSubjectId: number): Promise<void> {
  requireRole(ctx.actor, "teacher");
  requireId(classSubjectId);
  const [found] = await ctx.db
    .select({ teacherId: classSubject.teacherId })
    .from(classSubject)
    .where(eq(classSubject.id, classSubjectId));
  if (!found) throw new NotFound();
  if (found.teacherId === ctx.actor.userId) return;
  throw new AccessDenied("not this Class Subject's Subject Teacher");
}

/** Ids arrive from URLs and forms; one that isn't a whole number names nothing. */
function requireId(id: number): void {
  if (!Number.isSafeInteger(id)) throw new NotFound();
}

/**
 * Who may see a Student's profile and photo: the Admin, and the Student themselves.
 * Teachers are refused until the roster rule (Teachers see the Students they teach)
 * is added here.
 */
export function requireCanSeeStudent(actor: Actor, studentId: string): void {
  if (actor.role === "admin") return;
  if (actor.role === "student" && actor.userId === studentId) return;
  throw new AccessDenied("may not see this Student");
}

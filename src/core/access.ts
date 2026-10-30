// The access policy: the one place that answers "may this actor do this?".
// Commands and queries call these guards first; the UI never decides access.
// Add new rules here (e.g. Students and Parents, Class rosters) as tickets need them.
//
// Classes and Class Subjects (spec, "Identity and access"):
//   - An Admin can see and act on everything.
//   - A Subject Teacher can see their own Class Subjects.
//   - A Class Teacher can also see every Class Subject of their Class.
//   - Students see no Class Subject (until a later ticket says otherwise).
//
// Rosters and Students (ticket 06):
//   - A Class's Teachers (its Class Teacher and its Subject Teachers) see its roster.
//   - A Student's Teachers (the Teachers of the Class they're enrolled in today) see
//     the Student's profile and photo, as do the Admin and the Student.
import { and, eq, gte, isNull, lte, or, type SQL, sql } from "drizzle-orm";
import { classSubject, enrollment, schoolClass } from "@/db/schema";
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
 * A Class's Teachers: its Class Teacher and the Subject Teacher of any of its Class
 * Subjects. As SQL over `schoolClass`, for use in a WHERE clause.
 */
export function isTeacherOfClass(teacherId: string): SQL<boolean> {
  return sql<boolean>`(${schoolClass.classTeacherId} = ${teacherId} or exists (
    select 1 from ${classSubject}
    where ${classSubject.classId} = ${schoolClass.id} and ${classSubject.teacherId} = ${teacherId}))`;
}

/** A Class's roster (its Students on a date): the Admin and the Class's Teachers. */
export async function requireCanSeeClassRoster(ctx: Ctx, classId: number): Promise<void> {
  requireRole(ctx.actor, "admin", "teacher");
  requireId(classId);
  const [found] = await ctx.db
    .select({ isTeacher: ctx.actor.role === "teacher" ? isTeacherOfClass(ctx.actor.userId) : sql<boolean>`false` })
    .from(schoolClass)
    .where(eq(schoolClass.id, classId));
  if (!found) throw new NotFound();
  if (ctx.actor.role === "admin" || found.isTeacher) return;
  throw new AccessDenied("not a Teacher of this Class");
}

/** Ids arrive from URLs and forms; one that isn't a whole number names nothing. */
function requireId(id: number): void {
  if (!Number.isSafeInteger(id)) throw new NotFound();
}

/**
 * Who may see a Student's profile and photo: the Admin, the Student themselves, and
 * the Student's Teachers. A Student's Teachers are the Teachers (Class Teacher and
 * Subject Teachers, see `isTeacherOfClass`) of a Class the Student is enrolled in
 * today, by the Clock. A Teacher from a past Enrollment no longer qualifies.
 */
export async function requireCanSeeStudent(ctx: Ctx, studentId: string): Promise<void> {
  const { actor } = ctx;
  if (actor.role === "admin") return;
  if (actor.role === "student" && actor.userId === studentId) return;
  if (actor.role === "teacher") {
    const today = ctx.clock.today();
    const [found] = await ctx.db
      .select({ id: enrollment.id })
      .from(enrollment)
      .innerJoin(schoolClass, eq(schoolClass.id, enrollment.classId))
      .where(
        and(
          eq(enrollment.studentId, studentId),
          lte(enrollment.startDate, today),
          or(isNull(enrollment.endDate), gte(enrollment.endDate, today)),
          isTeacherOfClass(actor.userId),
        ),
      )
      .limit(1);
    if (found) return;
  }
  throw new AccessDenied("may not see this Student");
}

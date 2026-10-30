// The access policy: the one place that answers "may this actor do this?".
// Commands and queries call these guards first; the UI never decides access.
// Add new rules here (e.g. canSeeClass, canActOnClassSubject) as tickets need them.
import type { Actor, Role } from "./context";
import { AccessDenied } from "./errors";

export function requireRole(actor: Actor, ...roles: Role[]): void {
  if (!roles.includes(actor.role)) throw new AccessDenied(`requires role ${roles.join(" or ")}`);
}

export function requireAdmin(actor: Actor): void {
  requireRole(actor, "admin");
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

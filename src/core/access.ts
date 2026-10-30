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

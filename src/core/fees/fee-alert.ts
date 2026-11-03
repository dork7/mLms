// The Fee Alert: shown to the Admin and the Student wherever that Student appears, while
// they have any Overdue Fee Assignment. Teachers never get it: both queries refuse them,
// and no Teacher screen calls them. It never blocks anything; it only informs.
import { inArray } from "drizzle-orm";
import { feeAssignment } from "@/db/schema";
import { requireCanSeeFees, requireRole } from "../access";
import type { Ctx } from "../context";
import { type FeeAssignmentView, feeAssignmentViews } from "./fee-assignments";

/** A Student's Overdue Fee Assignments, soonest due first. Never empty. */
export type FeeAlert = { studentId: string; overdue: FeeAssignmentView[] };

/** The Student's Fee Alert, or null when nothing is Overdue: the Admin and that Student only. */
export async function studentFeeAlert(ctx: Ctx, input: { studentId: string }): Promise<FeeAlert | null> {
  const [alert] = await feeAlerts(ctx, { studentIds: [input.studentId] });
  return alert ?? null;
}

/**
 * The Fee Alerts of the given Students (for a screen showing several, such as a Class's
 * Report Cards), in the order given, leaving out those with nothing Overdue. The Admin
 * for anyone, a Student for themselves only.
 */
export async function feeAlerts(ctx: Ctx, input: { studentIds: string[] }): Promise<FeeAlert[]> {
  requireRole(ctx.actor, "admin", "student");
  const studentIds = [...new Set(input.studentIds)];
  for (const studentId of studentIds) requireCanSeeFees(ctx.actor, studentId);
  if (studentIds.length === 0) return [];
  const overdue = (await feeAssignmentViews(ctx, inArray(feeAssignment.studentId, studentIds))).filter((a) => a.overdue);
  return studentIds
    .map((studentId) => ({
      studentId,
      overdue: overdue.filter((a) => a.studentId === studentId),
    }))
    .filter((alert) => alert.overdue.length > 0);
}

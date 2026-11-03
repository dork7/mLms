// Leave Requests: a Teacher (and, from ticket 22, a Student) asks to be away for a date
// range with a reason and an optional attachment, and someone with the right decides it.
// Who may request, see and decide is in `access.ts`; this file holds the commands and queries.
import { desc, eq, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Db } from "@/db/client";
import { leaveAttachment, leaveRequest, user } from "@/db/schema";
import { requireAdmin, requireCanDecideLeaveRequest, requireCanRequestLeave, requireCanSeeLeaveRequest } from "../access";
import type { Ctx } from "../context";
import { isCalendarDate } from "../dates";
import { InvalidInput } from "../errors";
import { type Attachment, type AttachmentUpload, checkAttachment } from "./attachment";

export type LeaveStatus = "pending" | "approved" | "rejected";

export type LeaveRequestRow = {
  id: number;
  requester: string;
  startDate: string;
  endDate: string;
  reason: string;
  attachment: { fileName: string } | null;
  status: LeaveStatus;
  submittedAt: Date;
  decidedBy: string | null;
  decidedAt: Date | null;
};

export const MAX_REASON_LENGTH = 1000;

export type SubmitLeaveRequestInput = {
  startDate: string;
  endDate: string;
  reason: string;
  attachment?: AttachmentUpload;
};

/** The acting person asks for leave for themselves. Returns the new request's id. */
export async function submitLeaveRequest(ctx: Ctx, input: SubmitLeaveRequestInput): Promise<{ id: number }> {
  requireCanRequestLeave(ctx.actor);
  if (!isCalendarDate(input.startDate) || !isCalendarDate(input.endDate)) {
    throw new InvalidInput("errors.leaveDateInvalid");
  }
  if (input.endDate < input.startDate) throw new InvalidInput("errors.leaveEndBeforeStart");
  const reason = input.reason.trim();
  if (!reason) throw new InvalidInput("errors.leaveReasonRequired");
  if (reason.length > MAX_REASON_LENGTH) throw new InvalidInput("errors.leaveReasonTooLong");
  const attachment = input.attachment ? checkAttachment(input.attachment) : null;
  return ctx.db.transaction(async (tx) => {
    const [created] = await tx
      .insert(leaveRequest)
      .values({
        requesterId: ctx.actor.userId,
        startDate: input.startDate,
        endDate: input.endDate,
        reason,
        submittedAt: ctx.clock.now(),
      })
      .returning({ id: leaveRequest.id });
    if (attachment) {
      await tx.insert(leaveAttachment).values({
        leaveRequestId: created.id,
        fileName: attachment.fileName,
        contentType: attachment.contentType,
        data: Buffer.from(attachment.data),
      });
    }
    return created;
  });
}

export type LeaveDecision = "approved" | "rejected";

/**
 * Approves or rejects a Leave Request, recording who decided and when. A decided request
 * can be decided again (the latest decision stands), so a mistake can be put right.
 */
export async function decideLeaveRequest(
  ctx: Ctx,
  input: { leaveRequestId: number; decision: LeaveDecision },
): Promise<void> {
  await requireCanDecideLeaveRequest(ctx, input.leaveRequestId);
  if (input.decision !== "approved" && input.decision !== "rejected") {
    throw new InvalidInput("errors.leaveDecisionInvalid");
  }
  await ctx.db
    .update(leaveRequest)
    .set({ status: input.decision, decidedBy: ctx.actor.userId, decidedAt: ctx.clock.now() })
    .where(eq(leaveRequest.id, input.leaveRequestId));
}

/** The acting person's own Leave Requests, newest first. */
export async function myLeaveRequests(ctx: Ctx): Promise<LeaveRequestRow[]> {
  requireCanRequestLeave(ctx.actor);
  return leaveRequestRows(ctx.db, eq(leaveRequest.requesterId, ctx.actor.userId));
}

export type LeaveRequestQueue = { pending: LeaveRequestRow[]; decided: LeaveRequestRow[] };

/**
 * The Admin's Teacher Leave Requests: pending ones oldest first (the order to work
 * through them), then decided ones most recently decided first.
 */
export async function teacherLeaveRequests(ctx: Ctx): Promise<LeaveRequestQueue> {
  requireAdmin(ctx.actor);
  return queueOf(await leaveRequestRows(ctx.db, eq(user.role, "teacher")));
}

/** Splits rows into pending (oldest first) and decided (latest decision first). */
export function queueOf(rows: LeaveRequestRow[]): LeaveRequestQueue {
  const time = (d: Date | null) => d?.getTime() ?? 0;
  return {
    pending: rows
      .filter((r) => r.status === "pending")
      .sort((a, b) => time(a.submittedAt) - time(b.submittedAt) || a.id - b.id),
    decided: rows
      .filter((r) => r.status !== "pending")
      .sort((a, b) => time(b.decidedAt) - time(a.decidedAt) || b.id - a.id),
  };
}

/** A Leave Request's attachment, or null if it has none: for whoever may see the request. */
export async function getLeaveAttachment(ctx: Ctx, input: { leaveRequestId: number }): Promise<Attachment | null> {
  await requireCanSeeLeaveRequest(ctx, input.leaveRequestId);
  const [found] = await ctx.db
    .select({ fileName: leaveAttachment.fileName, contentType: leaveAttachment.contentType, data: leaveAttachment.data })
    .from(leaveAttachment)
    .where(eq(leaveAttachment.leaveRequestId, input.leaveRequestId));
  return found ? { ...found, data: new Uint8Array(found.data) } : null;
}

const decider = alias(user, "decider");

/**
 * Leave Request rows matching `where` (over `leaveRequest`, the requester as `user`),
 * newest first. Unguarded: callers check access first.
 */
export async function leaveRequestRows(db: Db, where: SQL | undefined): Promise<LeaveRequestRow[]> {
  const rows = await db
    .select({
      id: leaveRequest.id,
      requester: user.name,
      startDate: leaveRequest.startDate,
      endDate: leaveRequest.endDate,
      reason: leaveRequest.reason,
      fileName: leaveAttachment.fileName,
      status: leaveRequest.status,
      submittedAt: leaveRequest.submittedAt,
      decidedBy: decider.name,
      decidedAt: leaveRequest.decidedAt,
    })
    .from(leaveRequest)
    .innerJoin(user, eq(user.id, leaveRequest.requesterId))
    .leftJoin(decider, eq(decider.id, leaveRequest.decidedBy))
    .leftJoin(leaveAttachment, eq(leaveAttachment.leaveRequestId, leaveRequest.id))
    .where(where)
    .orderBy(desc(leaveRequest.submittedAt), desc(leaveRequest.id));
  return rows.map(({ fileName, ...row }) => ({ ...row, attachment: fileName === null ? null : { fileName } }));
}

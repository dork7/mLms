// Leave Requests: a Teacher or a Student asks to be away for a date
// range with a reason and an optional attachment, and someone with the right decides it.
// Who may request, see and decide is in `access.ts`; this file holds the commands and queries.
import { desc, eq, inArray, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Db } from "@/db/client";
import { enrollment, leaveAttachment, leaveRequest, schoolClass, user } from "@/db/schema";
import {
  isCurrentClassTeacher,
  requireAdmin,
  requireCanDecideLeaveRequest,
  requireCanRequestLeave,
  requireCanSeeLeaveRequest,
  requireRole,
} from "../access";
import type { Ctx, Role } from "../context";
import { isCalendarDate } from "../dates";
import { InvalidInput, NotFound } from "../errors";
import { type Attachment, type AttachmentUpload, checkAttachment } from "./attachment";
import { excuseAbsentMarks, restoreExcusedMarks } from "./excused-marks";

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

/** What a decision did to the requester's Marks. Always zero for a Teacher's request. */
export type LeaveDecisionOutcome = {
  /** Absent Marks in the leave dates made Exempt by an approval. */
  marksExempted: number;
  /** Marks this request had made Exempt, put back to Absent by a rejection. */
  marksRestored: number;
  /** Marks that should have changed but were skipped: Published (frozen) or in a Closed year. */
  marksFrozen: number;
};

/**
 * Approves or rejects a Leave Request, recording who decided and when. A decided request
 * can be decided again (the latest decision stands), so a mistake can be put right and the
 * Admin can override a Class Teacher. For a Student's request, in the same transaction,
 * approving excuses their Absent Marks in the leave dates and rejecting puts back the ones
 * this request excused (see `excused-marks.ts`). Frozen Marks are skipped, not refused.
 */
export async function decideLeaveRequest(
  ctx: Ctx,
  input: { leaveRequestId: number; decision: LeaveDecision },
): Promise<LeaveDecisionOutcome> {
  await requireCanDecideLeaveRequest(ctx, input.leaveRequestId);
  if (input.decision !== "approved" && input.decision !== "rejected") {
    throw new InvalidInput("errors.leaveDecisionInvalid");
  }
  return ctx.db.transaction(async (tx) => {
    // One decision at a time per request, so two deciders can't interleave their Mark changes.
    const [request] = await tx
      .select({
        id: leaveRequest.id,
        studentId: leaveRequest.requesterId,
        startDate: leaveRequest.startDate,
        endDate: leaveRequest.endDate,
        role: user.role,
      })
      .from(leaveRequest)
      .innerJoin(user, eq(user.id, leaveRequest.requesterId))
      .where(eq(leaveRequest.id, input.leaveRequestId))
      .for("update", { of: leaveRequest });
    if (!request) throw new NotFound();
    await tx
      .update(leaveRequest)
      .set({ status: input.decision, decidedBy: ctx.actor.userId, decidedAt: ctx.clock.now() })
      .where(eq(leaveRequest.id, input.leaveRequestId));
    const outcome = { marksExempted: 0, marksRestored: 0, marksFrozen: 0 };
    if (request.role !== "student") return outcome;
    if (input.decision === "approved") {
      const { exempted, frozen } = await excuseAbsentMarks(tx, request);
      return { ...outcome, marksExempted: exempted, marksFrozen: frozen };
    }
    const { restored, frozen } = await restoreExcusedMarks(tx, request);
    return { ...outcome, marksRestored: restored, marksFrozen: frozen };
  });
}

/** The acting person's own Leave Requests, newest first. */
export async function myLeaveRequests(ctx: Ctx): Promise<LeaveRequestRow[]> {
  requireCanRequestLeave(ctx.actor);
  return leaveRequestRows(ctx.db, eq(leaveRequest.requesterId, ctx.actor.userId));
}

export type LeaveRequestQueue<R extends LeaveRequestRow = LeaveRequestRow> = { pending: R[]; decided: R[] };

/**
 * The Admin's Teacher Leave Requests: pending ones oldest first (the order to work
 * through them), then decided ones most recently decided first.
 */
export async function teacherLeaveRequests(ctx: Ctx): Promise<LeaveRequestQueue> {
  requireAdmin(ctx.actor);
  return queueOf(await leaveRequestRows(ctx.db, eq(user.role, "teacher")));
}

/** The Admin's Student Leave Requests, in the same order. The Admin may decide any of them. */
export async function studentLeaveRequests(ctx: Ctx): Promise<LeaveRequestQueue> {
  requireAdmin(ctx.actor);
  return queueOf(await leaveRequestRows(ctx.db, eq(user.role, "student")));
}

export type ClassLeaveRequestRow = LeaveRequestRow & {
  /** The Class the Student is in today. */
  class: string;
  /** False once the Admin has decided it: then only the Admin can change it. */
  canDecide: boolean;
};

/**
 * A Class Teacher's list: the Leave Requests of every Student currently in a Class they're
 * Class Teacher of, in the same order as the Admin's. A Student who moves Class takes their
 * requests to the new Class Teacher.
 */
export async function classLeaveRequests(ctx: Ctx): Promise<LeaveRequestQueue<ClassLeaveRequestRow>> {
  requireRole(ctx.actor, "teacher");
  const students = await ctx.db
    .select({ studentId: enrollment.studentId, class: schoolClass.name })
    .from(enrollment)
    .innerJoin(schoolClass, eq(schoolClass.id, enrollment.classId))
    .where(isCurrentClassTeacher(ctx.actor.userId, ctx.clock.today()));
  if (students.length === 0) return { pending: [], decided: [] };
  const classOf = new Map(students.map((s) => [s.studentId, s.class]));
  const records = await leaveRecords(ctx.db, inArray(leaveRequest.requesterId, [...classOf.keys()]));
  return queueOf(
    records.map(({ requesterId, decidedByRole, ...row }) => ({
      ...row,
      class: classOf.get(requesterId)!,
      canDecide: decidedByRole !== "admin",
    })),
  );
}

/** Splits rows into pending (oldest first) and decided (latest decision first). */
export function queueOf<R extends LeaveRequestRow>(rows: R[]): LeaveRequestQueue<R> {
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
  return (await leaveRecords(db, where)).map(({ requesterId: _, decidedByRole: __, ...row }) => row);
}

type LeaveRecord = LeaveRequestRow & { requesterId: string; decidedByRole: Role | null };

async function leaveRecords(db: Db, where: SQL | undefined): Promise<LeaveRecord[]> {
  const rows = await db
    .select({
      id: leaveRequest.id,
      requesterId: leaveRequest.requesterId,
      requester: user.name,
      startDate: leaveRequest.startDate,
      endDate: leaveRequest.endDate,
      reason: leaveRequest.reason,
      fileName: leaveAttachment.fileName,
      status: leaveRequest.status,
      submittedAt: leaveRequest.submittedAt,
      decidedBy: decider.name,
      decidedByRole: decider.role,
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

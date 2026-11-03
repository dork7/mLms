// Fee Reminders: emails to a Student's email address about an upcoming or Overdue Fee
// Assignment, and the report of Students with no email.
//
//   sendDailyFeeReminders(deps): the daily job (scripts/send-fee-reminders.ts). The timing
//     rule (`remindsSince`) reads the school-wide timings and the log of reminders sent.
//   sendFeeRemindersNow(ctx, { feeId }): the Admin's "Send reminders now" for one Fee.
//     It ignores the timing rule but goes through the same `send`, so it is logged, the
//     daily job counts it, and Paid, Waived and no-email are skipped the same way.
//
// The log (`fee_reminder`) allows one reminder per Fee Assignment per school day, so two
// runs on one day, or a run racing a press of "Send reminders now", never double-send.
import { and, asc, eq, inArray, isNull, lte, max } from "drizzle-orm";
import { fee, feeAssignment, feeReminder, schoolSettings, student, user } from "@/db/schema";
import type { Db } from "@/db/client";
import { t } from "@/i18n";
import { requireAdmin } from "../access";
import type { Ctx, Deps } from "../context";
import { InvalidInput } from "../errors";
import { addDays } from "../dates";
import { type FeeAssignmentView, feeAssignmentViews, getFee } from "./fee-assignments";
import { isOverdue } from "./fee-status";
import { formatAed } from "./money";

export type FeeReminderSettings = { leadDays: number; intervalDays: number };

/**
 * What a send did, counted in Fee Assignments. A Student with no email is skipped
 * (`noEmail`), never an error. `alreadySentToday`: reminded earlier the same day.
 * `failed`: the Mailer refused it; nothing is logged, so the next run tries again.
 */
export type FeeReminderResult = { sent: number; noEmail: number; alreadySentToday: number; failed: number };

/**
 * The daily job: a system command with no acting person. Sends each outstanding Fee
 * Assignment the reminder it is due today, if any, by the timing rule in `remindsSince`.
 */
export async function sendDailyFeeReminders(deps: Deps): Promise<FeeReminderResult> {
  const today = deps.clock.today();
  const settings = await feeReminderSettings(deps.db);
  const candidates = await feeAssignmentViews(
    deps,
    and(isNull(feeAssignment.waivedAt), lte(fee.dueDate, addDays(today, settings.leadDays))),
  );
  const outstanding = candidates.filter(isOutstanding);
  const lastSent = await lastReminderOn(deps.db, outstanding.map((a) => a.id));
  const due = outstanding.filter((a) => {
    const since = remindsSince(today, a.fee.dueDate, settings);
    const last = lastSent.get(a.id);
    return since !== null && (!last || last < since);
  });
  return send(deps, due, null);
}

/**
 * "Send reminders now" for one Fee: every outstanding Fee Assignment of it, whatever the
 * timing rule says, apart from one already reminded today. It is logged as the Admin's,
 * and the daily job counts it like its own (see `remindsSince`).
 */
export async function sendFeeRemindersNow(ctx: Ctx, input: { feeId: number }): Promise<FeeReminderResult> {
  const { assignments } = await getFee(ctx, input); // Admin only; NotFound for an unknown Fee
  return send(ctx, assignments.filter(isOutstanding), ctx.actor.userId);
}

/**
 * The timing rule. An outstanding Fee Assignment is due a reminder today if none was sent
 * on or after the date this returns (null: none is due today):
 *   - upcoming, from `leadDays` before the due date up to the due date itself: the start of
 *     that window, so it gets one upcoming reminder;
 *   - Overdue, from the day after the due date: `intervalDays - 1` days ago, but never before
 *     it became Overdue, so the first Overdue day always gets one and then one every interval.
 * A missed day is caught up the next day with one reminder, never one per missed day.
 * Any logged reminder counts, including "Send reminders now".
 */
function remindsSince(today: string, dueDate: string, settings: FeeReminderSettings): string | null {
  if (today > dueDate) {
    const intervalStart = addDays(today, 1 - settings.intervalDays);
    const firstOverdueDay = addDays(dueDate, 1);
    return intervalStart > firstOverdueDay ? intervalStart : firstOverdueDay;
  }
  const windowStart = addDays(dueDate, -settings.leadDays);
  return today >= windowStart ? windowStart : null;
}

function isOutstanding(a: FeeAssignmentView): boolean {
  return a.status === "unpaid" || a.status === "partiallyPaid";
}

const MAX_REMINDER_DAYS = 365;

/** The Admin sets both timings: whole numbers of days from 1 to 365. */
export async function setFeeReminderSettings(ctx: Ctx, input: FeeReminderSettings): Promise<void> {
  requireAdmin(ctx.actor);
  for (const days of [input.leadDays, input.intervalDays]) {
    if (!Number.isInteger(days) || days < 1 || days > MAX_REMINDER_DAYS) {
      throw new InvalidInput("errors.feeReminderDaysInvalid");
    }
  }
  const values = { feeReminderLeadDays: input.leadDays, feeReminderIntervalDays: input.intervalDays };
  await ctx.db
    .insert(schoolSettings)
    .values({ id: 1, ...values })
    .onConflictDoUpdate({ target: schoolSettings.id, set: values });
}

export async function getFeeReminderSettings(ctx: Ctx): Promise<FeeReminderSettings> {
  requireAdmin(ctx.actor);
  return feeReminderSettings(ctx.db);
}

/** The school-wide timings, defaulting to 7 and 7. No access check. */
export async function feeReminderSettings(db: Db): Promise<FeeReminderSettings> {
  const [row] = await db
    .select({ leadDays: schoolSettings.feeReminderLeadDays, intervalDays: schoolSettings.feeReminderIntervalDays })
    .from(schoolSettings);
  return row ?? { leadDays: 7, intervalDays: 7 };
}

async function lastReminderOn(db: Db, feeAssignmentIds: number[]): Promise<Map<number, string>> {
  if (feeAssignmentIds.length === 0) return new Map();
  const rows = await db
    .select({ id: feeReminder.feeAssignmentId, last: max(feeReminder.sentOn) })
    .from(feeReminder)
    .where(inArray(feeReminder.feeAssignmentId, feeAssignmentIds))
    .groupBy(feeReminder.feeAssignmentId);
  return new Map(rows.flatMap((r) => (r.last ? [[r.id, r.last] as const] : [])));
}

/** Raised inside the claim's transaction so a refused email undoes its log row. */
class MailFailed extends Error {}

/**
 * Sends each Fee Assignment its reminder: claims today's row in the log, then emails, in one
 * transaction. A second claim for the same day finds the row (waiting for a concurrent one
 * to commit) and sends nothing.
 */
async function send(deps: Deps, due: FeeAssignmentView[], sentBy: string | null): Promise<FeeReminderResult> {
  const result: FeeReminderResult = { sent: 0, noEmail: 0, alreadySentToday: 0, failed: 0 };
  if (due.length === 0) return result;
  const emails = await studentEmails(deps.db, due.map((a) => a.studentId));
  const today = deps.clock.today();
  for (const a of due) {
    const to = emails.get(a.studentId);
    if (!to) {
      result.noEmail++;
      continue;
    }
    const overdue = isOverdue({ dueDate: a.fee.dueDate, status: a.status }, today);
    try {
      const outcome = await deps.db.transaction(async (tx) => {
        const claimed = await tx
          .insert(feeReminder)
          .values({
            feeAssignmentId: a.id,
            kind: overdue ? "overdue" : "upcoming",
            sentOn: today,
            sentAt: deps.clock.now(),
            sentTo: to,
            sentBy,
          })
          .onConflictDoNothing()
          .returning({ id: feeReminder.id });
        if (claimed.length === 0) return "alreadySentToday" as const;
        try {
          await deps.mailer.send({ to, ...reminderEmail(a, overdue) });
        } catch (err) {
          throw new MailFailed(String(err));
        }
        return "sent" as const;
      });
      result[outcome]++;
    } catch (err) {
      if (!(err instanceof MailFailed)) throw err;
      result.failed++;
    }
  }
  return result;
}

async function studentEmails(db: Db, studentIds: string[]): Promise<Map<string, string>> {
  const rows = await db
    .select({ id: student.userId, email: student.email })
    .from(student)
    .where(inArray(student.userId, [...new Set(studentIds)]));
  return new Map(rows.flatMap((r) => (r.email ? [[r.id, r.email] as const] : [])));
}

function reminderEmail(a: FeeAssignmentView, overdue: boolean): { subject: string; text: string } {
  const e = "feeReminders.email";
  const date = a.fee.dueDate;
  const status = t(`fees.status.${a.status}`);
  const intro = { student: a.studentName, number: a.studentNumber, date };
  return {
    subject: overdue
      ? t(`${e}.overdueSubject`, { fee: a.fee.name })
      : t(`${e}.upcomingSubject`, { fee: a.fee.name, date }),
    text: [
      overdue ? t(`${e}.overdueIntro`, intro) : t(`${e}.upcomingIntro`, intro),
      "",
      t(`${e}.feeLine`, { fee: a.fee.name }),
      t(`${e}.amountLine`, { amount: formatAed(a.fee.amountFils) }),
      t(`${e}.dueLine`, { date }),
      t(`${e}.statusLine`, { status: overdue ? t(`${e}.overdueStatus`, { status }) : status }),
      t(`${e}.outstandingLine`, { amount: formatAed(Math.max(a.fee.amountFils - a.paidFils, 0)) }),
      "",
      t(`${e}.closing`),
    ].join("\n"),
  };
}

export type NoEmailRow = {
  studentId: string;
  name: string;
  studentNumber: string;
  guardianContact: string;
  /** Any Fee Assignment that isn't Paid or Waived. */
  hasOutstandingFee: boolean;
};

/** Every Student with no email on record, by name: Fee Reminders can't reach them. Admin only. */
export async function noEmailReport(ctx: Ctx): Promise<NoEmailRow[]> {
  requireAdmin(ctx.actor);
  const students = await ctx.db
    .select({
      studentId: student.userId,
      name: user.name,
      studentNumber: student.studentNumber,
      guardianContact: student.guardianContact,
    })
    .from(student)
    .innerJoin(user, eq(user.id, student.userId))
    .where(isNull(student.email))
    .orderBy(asc(user.name), asc(student.studentNumber));
  const owing = new Set(
    (await feeAssignmentViews(ctx, and(isNull(student.email), isNull(feeAssignment.waivedAt))))
      .filter(isOutstanding)
      .map((a) => a.studentId),
  );
  return students.map((s) => ({ ...s, hasOutstandingFee: owing.has(s.studentId) }));
}

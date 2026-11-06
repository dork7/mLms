"use server";
// Fee server actions. Each one only reads the form, calls one layer command as the
// current actor, and returns the refusal key or revalidates.
import { revalidatePath } from "next/cache";
import type { FormState } from "@/app/form-kit";
import {
  applyFeeToGrade,
  applyFeeToStudents,
  unwaiveFeeAssignment,
  waiveFeeAssignment,
} from "@/core/fees/fee-assignments";
import {
  type FeeReminderResult,
  sendFeeRemindersNow,
  setFeeReminderSettings,
} from "@/core/fees/fee-reminders";
import { createFee } from "@/core/fees/fees";
import { logPaymentRecord } from "@/core/fees/payment-records";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";

export type ApplyState = FormState & { assigned?: number };

export async function defineFee(prev: FormState, form: FormData): Promise<FormState> {
  const input = {
    name: String(form.get("name") ?? ""),
    amount: String(form.get("amount") ?? ""),
    dueDate: String(form.get("dueDate") ?? ""),
  };
  try {
    await asCurrentActor((ctx) => createFee(ctx, input));
  } catch (err) {
    return { error: refusalKey(err), saved: prev.saved };
  }
  revalidatePath("/admin/fees");
  return { saved: prev.saved + 1 };
}

/** Applies the Fee to a Grade (`gradeId`) or to the ticked Students (`studentId`, repeated). */
export async function applyFee(prev: ApplyState, form: FormData): Promise<ApplyState> {
  const feeId = Number(form.get("feeId"));
  let assigned: number;
  try {
    ({ assigned } = await asCurrentActor((ctx) =>
      form.has("gradeId")
        ? applyFeeToGrade(ctx, { feeId, gradeId: Number(form.get("gradeId")) })
        : applyFeeToStudents(ctx, { feeId, studentIds: form.getAll("studentId").map(String) }),
    ));
  } catch (err) {
    return { error: refusalKey(err), saved: prev.saved };
  }
  revalidatePath(`/admin/fees/${feeId}`);
  return { saved: prev.saved + 1, assigned };
}

export async function logPayment(prev: FormState, form: FormData): Promise<FormState> {
  const input = {
    feeAssignmentId: Number(form.get("feeAssignmentId")),
    amount: String(form.get("amount") ?? ""),
    date: String(form.get("date") ?? ""),
    method: String(form.get("method") ?? ""),
    reference: String(form.get("reference") ?? ""),
  };
  try {
    await asCurrentActor((ctx) => logPaymentRecord(ctx, input));
  } catch (err) {
    return { error: refusalKey(err), saved: prev.saved };
  }
  revalidatePath(`/admin/fees/assignments/${input.feeAssignmentId}`);
  return { saved: prev.saved + 1 };
}

export async function setWaived(form: FormData): Promise<void> {
  const feeAssignmentId = Number(form.get("feeAssignmentId"));
  const waive = form.get("waive") === "true";
  await asCurrentActor((ctx) => (waive ? waiveFeeAssignment : unwaiveFeeAssignment)(ctx, { feeAssignmentId }));
  revalidatePath(`/admin/fees/assignments/${feeAssignmentId}`);
}

export type RemindState = FormState & { result?: FeeReminderResult };

export async function saveReminderSettings(prev: FormState, form: FormData): Promise<FormState> {
  // An empty or non-numeric field becomes NaN or 0, which the layer refuses.
  const input = { leadDays: Number(form.get("leadDays")), intervalDays: Number(form.get("intervalDays")) };
  try {
    await asCurrentActor((ctx) => setFeeReminderSettings(ctx, input));
  } catch (err) {
    return { error: refusalKey(err), saved: prev.saved };
  }
  revalidatePath("/admin/fees");
  return { saved: prev.saved + 1 };
}

export async function sendRemindersNow(prev: RemindState, form: FormData): Promise<RemindState> {
  const feeId = Number(form.get("feeId"));
  let result: FeeReminderResult;
  try {
    result = await asCurrentActor((ctx) => sendFeeRemindersNow(ctx, { feeId }));
  } catch (err) {
    return { error: refusalKey(err), saved: prev.saved };
  }
  return { saved: prev.saved + 1, result };
}

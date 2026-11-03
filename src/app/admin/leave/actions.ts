"use server";
import { revalidatePath } from "next/cache";
import { decideLeaveRequest, type LeaveDecision } from "@/core/leave/leave-requests";
import { asCurrentActor } from "@/web/as-current-actor";

/** Approves or rejects one Leave Request (`decision` is "approved" or "rejected"). */
export async function decideLeaveAction(form: FormData): Promise<void> {
  const leaveRequestId = Number(form.get("leaveRequestId"));
  const decision = String(form.get("decision") ?? "") as LeaveDecision;
  await asCurrentActor((ctx) => decideLeaveRequest(ctx, { leaveRequestId, decision }));
  revalidatePath("/admin/leave");
}

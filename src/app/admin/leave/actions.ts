"use server";
import { decideFromForm } from "@/app/leave-decision";

/** Approves or rejects one Leave Request (`decision` is "approved" or "rejected"). */
export async function decideLeaveAction(form: FormData): Promise<void> {
  await decideFromForm(form, "/admin/leave");
}

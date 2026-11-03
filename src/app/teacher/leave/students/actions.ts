"use server";
import { decideFromForm } from "@/app/leave-decision";

/** The Class Teacher approves or rejects one of their Class's Students' Leave Requests. */
export async function decideClassLeaveAction(form: FormData): Promise<void> {
  await decideFromForm(form, "/teacher/leave/students");
}

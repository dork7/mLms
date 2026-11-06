"use server";
// Submitting a Leave Request: read the form (with its optional file), call the layer as the
// current actor, and return the refusal key or revalidate.
import { revalidatePath } from "next/cache";
import type { FormState } from "@/app/form-kit";
import { submitLeaveRequest } from "@/core/leave/leave-requests";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";

export async function submitLeaveAction(prev: FormState, form: FormData): Promise<FormState> {
  const file = form.get("attachment");
  try {
    const attachment =
      file instanceof File && file.size > 0
        ? { fileName: file.name, data: new Uint8Array(await file.arrayBuffer()) }
        : undefined;
    await asCurrentActor((ctx) =>
      submitLeaveRequest(ctx, {
        startDate: String(form.get("startDate") ?? ""),
        endDate: String(form.get("endDate") ?? ""),
        reason: String(form.get("reason") ?? ""),
        attachment,
      }),
    );
  } catch (err) {
    return { error: refusalKey(err), saved: prev.saved };
  }
  revalidatePath("/teacher/leave");
  revalidatePath("/student/leave");
  return { saved: prev.saved + 1 };
}

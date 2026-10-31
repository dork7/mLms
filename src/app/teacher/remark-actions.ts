"use server";
// Saving Report Card remarks: read the form, call the layer as the current actor, and
// return the refusal key or revalidate. Who may write which remark is the layer's call.
import { revalidatePath } from "next/cache";
import { saveOverallRemark, saveSubjectRemark } from "@/core/report-cards/remarks";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import type { FormState } from "../admin/setup-actions";

export async function saveSubjectRemarkAction(prev: FormState, form: FormData): Promise<FormState> {
  const input = {
    classSubjectId: Number(form.get("classSubjectId")),
    termId: Number(form.get("termId")),
    studentId: String(form.get("studentId") ?? ""),
    remark: String(form.get("remark") ?? ""),
  };
  try {
    await asCurrentActor((ctx) => saveSubjectRemark(ctx, input));
  } catch (err) {
    return { error: refusalKey(err), saved: prev.saved };
  }
  revalidatePath(`/teacher/class-subjects/${input.classSubjectId}/remarks`);
  return { saved: prev.saved + 1 };
}

export async function saveOverallRemarkAction(prev: FormState, form: FormData): Promise<FormState> {
  const input = {
    classId: Number(form.get("classId")),
    termId: Number(form.get("termId")),
    studentId: String(form.get("studentId") ?? ""),
    remark: String(form.get("remark") ?? ""),
  };
  try {
    await asCurrentActor((ctx) => saveOverallRemark(ctx, input));
  } catch (err) {
    return { error: refusalKey(err), saved: prev.saved };
  }
  revalidatePath(`/teacher/classes/${input.classId}/remarks`);
  return { saved: prev.saved + 1 };
}

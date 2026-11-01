"use server";
// Saving Report Card remarks: read the form, call the layer as the current actor, and
// return the refusal key or revalidate. Who may write which remark is the layer's call.
import { revalidatePath } from "next/cache";
import type { Ctx } from "@/core/context";
import { saveOverallRemark, saveSubjectRemark } from "@/core/report-cards/remarks";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import type { FormState } from "@/app/form-kit";

type RemarkFields = { termId: number; studentId: string; remark: string };

async function saveRemark(
  prev: FormState,
  form: FormData,
  save: (ctx: Ctx, fields: RemarkFields) => Promise<void>,
  path: string,
): Promise<FormState> {
  const fields = {
    termId: Number(form.get("termId")),
    studentId: String(form.get("studentId") ?? ""),
    remark: String(form.get("remark") ?? ""),
  };
  try {
    await asCurrentActor((ctx) => save(ctx, fields));
  } catch (err) {
    return { error: refusalKey(err), saved: prev.saved };
  }
  revalidatePath(path);
  return { saved: prev.saved + 1 };
}

export async function saveSubjectRemarkAction(prev: FormState, form: FormData): Promise<FormState> {
  const classSubjectId = Number(form.get("classSubjectId"));
  return saveRemark(
    prev,
    form,
    (ctx, fields) => saveSubjectRemark(ctx, { classSubjectId, ...fields }),
    `/teacher/class-subjects/${classSubjectId}/remarks`,
  );
}

export async function saveOverallRemarkAction(prev: FormState, form: FormData): Promise<FormState> {
  const classId = Number(form.get("classId"));
  return saveRemark(
    prev,
    form,
    (ctx, fields) => saveOverallRemark(ctx, { classId, ...fields }),
    `/teacher/classes/${classId}/remarks`,
  );
}

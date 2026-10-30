"use server";
// Assessments and the marks grid: read the form, call the layer as the current
// actor, and return the refusal key or revalidate. No rules live here.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type AssessmentType, createAssessment, updateAssessment } from "@/core/assessments/assessments";
import { type MarkValue, saveMarks } from "@/core/assessments/marks";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import type { FormState } from "../../admin/setup-actions";

export async function createAssessmentAction(prev: FormState, form: FormData): Promise<FormState> {
  const input = {
    classSubjectId: Number(form.get("classSubjectId")),
    type: String(form.get("type") ?? "") as AssessmentType,
    date: String(form.get("date") ?? ""),
    maxMarks: toNumber(form.get("maxMarks")),
    weight: toNumber(form.get("weight")),
  };
  let id: number;
  try {
    ({ id } = await asCurrentActor((ctx) => createAssessment(ctx, input)));
  } catch (err) {
    return { error: refusalKey(err), saved: prev.saved };
  }
  revalidatePath(`/teacher/class-subjects/${input.classSubjectId}`);
  redirect(`/teacher/assessments/${id}`);
}

export async function updateAssessmentAction(prev: FormState, form: FormData): Promise<FormState> {
  const input = {
    assessmentId: Number(form.get("assessmentId")),
    maxMarks: toNumber(form.get("maxMarks")),
    weight: toNumber(form.get("weight")),
  };
  try {
    await asCurrentActor((ctx) => updateAssessment(ctx, input));
  } catch (err) {
    return { error: refusalKey(err), saved: prev.saved };
  }
  revalidatePath(`/teacher/assessments/${input.assessmentId}`);
  return { saved: prev.saved + 1 };
}

/**
 * The grid posts one `studentId` per row, with `status:<id>` ("score", "absent" or
 * "exempt") and `score:<id>`. An empty score with status "score" clears the Mark.
 */
export async function saveMarksAction(prev: FormState, form: FormData): Promise<FormState> {
  const assessmentId = Number(form.get("assessmentId"));
  const marks = form.getAll("studentId").map((value) => {
    const studentId = String(value);
    const status = String(form.get(`status:${studentId}`) ?? "score");
    const score = String(form.get(`score:${studentId}`) ?? "").trim();
    const mark: MarkValue =
      status === "absent" || status === "exempt" ? status : score === "" ? null : Number(score);
    return { studentId, mark };
  });
  try {
    await asCurrentActor((ctx) => saveMarks(ctx, { assessmentId, marks }));
  } catch (err) {
    return { error: refusalKey(err), saved: prev.saved };
  }
  revalidatePath(`/teacher/assessments/${assessmentId}`);
  return { saved: prev.saved + 1 };
}

/** A form number; an empty or malformed one becomes NaN, which the layer refuses. */
function toNumber(value: FormDataEntryValue | null): number {
  const text = String(value ?? "").trim();
  return text === "" ? Number.NaN : Number(text);
}

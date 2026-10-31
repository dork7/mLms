"use server";
// Exam server actions: read the form, call one layer command as the current actor,
// and return the refusal key or revalidate.
import { revalidatePath } from "next/cache";
import type { AssessmentType } from "@/core/assessments/assessments";
import { addExam } from "@/core/exams/exams";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import type { FormState } from "../setup-actions";

export async function addExamAction(prev: FormState, form: FormData): Promise<FormState> {
  const input = {
    classSubjectId: Number(form.get("classSubjectId")),
    roomId: Number(form.get("roomId")),
    type: String(form.get("type") ?? "") as AssessmentType,
    date: String(form.get("date") ?? ""),
    startTime: String(form.get("startTime") ?? ""),
    durationMinutes: Number(form.get("durationMinutes")),
    maxMarks: Number(form.get("maxMarks")),
    weight: Number(form.get("weight")),
  };
  try {
    await asCurrentActor((ctx) => addExam(ctx, input));
  } catch (err) {
    return { error: refusalKey(err), saved: prev.saved };
  }
  revalidatePath("/admin/exams");
  return { saved: prev.saved + 1 };
}

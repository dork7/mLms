"use server";
// Logging a Lesson: read the form, call the layer as the current actor, and return
// the refusal key or revalidate.
import { revalidatePath } from "next/cache";
import { logLesson } from "@/core/lessons/lessons";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import type { FormState } from "@/app/form-kit";

export async function logLessonAction(prev: FormState, form: FormData): Promise<FormState> {
  const input = {
    classSubjectId: Number(form.get("classSubjectId")),
    date: String(form.get("date") ?? ""),
    period: Number(form.get("period")),
    topic: String(form.get("topic") ?? ""),
    homework: String(form.get("homework") ?? ""),
  };
  try {
    await asCurrentActor((ctx) => logLesson(ctx, input));
  } catch (err) {
    return { error: refusalKey(err), saved: prev.saved };
  }
  revalidatePath(`/teacher/class-subjects/${input.classSubjectId}`);
  return { saved: prev.saved + 1 };
}

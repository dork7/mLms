"use server";
// Exam server actions: read the form, call one layer command as the current actor,
// and return the refusal key, revalidate or move on.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AssessmentType } from "@/core/assessments/assessments";
import { addExam, addGradeWideExam, deleteExam, rescheduleExam, rescheduleGradeWideExam } from "@/core/exams/exams";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusal } from "@/web/refusal";
import type { FormState } from "@/app/form-kit";

function sittingFrom(form: FormData) {
  return {
    type: String(form.get("type") ?? "") as AssessmentType,
    date: String(form.get("date") ?? ""),
    startTime: String(form.get("startTime") ?? ""),
    durationMinutes: Number(form.get("durationMinutes")),
    maxMarks: Number(form.get("maxMarks")),
    weight: Number(form.get("weight")),
  };
}

export async function addExamAction(prev: FormState, form: FormData): Promise<FormState> {
  const input = {
    classSubjectId: Number(form.get("classSubjectId")),
    roomId: Number(form.get("roomId")),
    ...sittingFrom(form),
  };
  try {
    await asCurrentActor((ctx) => addExam(ctx, input));
  } catch (err) {
    return { ...refusal(err), saved: prev.saved };
  }
  revalidatePath("/admin/exams");
  return { saved: prev.saved + 1 };
}

export async function addGradeWideExamAction(prev: FormState, form: FormData): Promise<FormState> {
  const [gradeId, subjectId] = String(form.get("gradeAndSubject") ?? "").split(":").map(Number);
  const input = {
    academicYearId: Number(form.get("academicYearId")),
    gradeId,
    subjectId,
    rooms: form.getAll("classSubjectId").map((id) => ({
      classSubjectId: Number(id),
      roomId: Number(form.get(`room:${id}`)),
    })),
    ...sittingFrom(form),
  };
  try {
    await asCurrentActor((ctx) => addGradeWideExam(ctx, input));
  } catch (err) {
    return { ...refusal(err), saved: prev.saved };
  }
  revalidatePath("/admin/exams");
  return { saved: prev.saved + 1 };
}

export async function rescheduleExamAction(prev: FormState, form: FormData): Promise<FormState> {
  const input = {
    examId: Number(form.get("examId")),
    roomId: Number(form.get("roomId")),
    date: String(form.get("date") ?? ""),
    startTime: String(form.get("startTime") ?? ""),
    durationMinutes: Number(form.get("durationMinutes")),
  };
  try {
    // A grade-wide Exam moves with its other Classes when the Admin leaves that ticked.
    const move = form.get("wholeExam") === "on" ? rescheduleGradeWideExam : rescheduleExam;
    await asCurrentActor((ctx) => move(ctx, input));
  } catch (err) {
    return { ...refusal(err), saved: prev.saved };
  }
  revalidatePath("/admin/exams", "layout");
  return { saved: prev.saved + 1 };
}

export async function deleteExamAction(prev: FormState, form: FormData): Promise<FormState> {
  const examId = Number(form.get("examId"));
  const termId = Number(form.get("termId"));
  try {
    await asCurrentActor((ctx) => deleteExam(ctx, { examId }));
  } catch (err) {
    return { ...refusal(err), saved: prev.saved };
  }
  revalidatePath("/admin/exams", "layout");
  // Back to the timetable on the Term the Exam was in, which then says it was deleted.
  redirect(Number.isInteger(termId) && termId > 0 ? `/admin/exams?term=${termId}&deleted=1` : "/admin/exams?deleted=1");
}

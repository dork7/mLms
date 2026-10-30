"use server";
// Class and Class Subject server actions. Each one only reads the form, calls one
// layer command as the current actor, and returns the refusal key or revalidates.
import { revalidatePath } from "next/cache";
import { createClassSubject, reassignSubjectTeacher } from "@/core/classes/class-subjects";
import { createClass } from "@/core/classes/classes";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import type { FormState } from "../setup-actions";

export async function addClass(prev: FormState, form: FormData): Promise<FormState> {
  const input = {
    academicYearId: Number(form.get("academicYearId")),
    gradeId: Number(form.get("gradeId")),
    name: String(form.get("name") ?? ""),
    classTeacherId: String(form.get("classTeacherId") ?? ""),
  };
  try {
    await asCurrentActor((ctx) => createClass(ctx, input));
  } catch (err) {
    return { error: refusalKey(err), saved: prev.saved };
  }
  revalidatePath("/admin/classes");
  return { saved: prev.saved + 1 };
}

export async function addClassSubject(prev: FormState, form: FormData): Promise<FormState> {
  const input = {
    classId: Number(form.get("classId")),
    subjectId: Number(form.get("subjectId")),
    teacherId: String(form.get("teacherId") ?? ""),
  };
  try {
    await asCurrentActor((ctx) => createClassSubject(ctx, input));
  } catch (err) {
    return { error: refusalKey(err), saved: prev.saved };
  }
  revalidatePath(`/admin/classes/${input.classId}`);
  return { saved: prev.saved + 1 };
}

export async function reassignTeacher(prev: FormState, form: FormData): Promise<FormState> {
  const input = {
    classSubjectId: Number(form.get("classSubjectId")),
    teacherId: String(form.get("teacherId") ?? ""),
  };
  try {
    await asCurrentActor((ctx) => reassignSubjectTeacher(ctx, input));
  } catch (err) {
    return { error: refusalKey(err), saved: prev.saved };
  }
  revalidatePath(`/admin/classes/${form.get("classId")}`);
  return { saved: prev.saved + 1 };
}

"use server";
// Year-end server actions. Each one only reads the form, calls one layer command as
// the current actor, and returns the refusal key or moves on.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { closeAcademicYear, type PromoteClassInput, promoteClass } from "@/core/year-end/year-end";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import type { FormState } from "@/app/form-kit";

export async function savePromotion(prev: FormState, form: FormData): Promise<FormState> {
  const toClass = String(form.get("toClassId") ?? "");
  const input: Required<Pick<PromoteClassInput, "repeating" | "leaving">> & PromoteClassInput = {
    classId: Number(form.get("classId")),
    toClassId: toClass === "" ? undefined : Number(toClass),
    repeating: [],
    leaving: [],
  };
  for (const studentId of form.getAll("studentId").map(String)) {
    const outcome = form.get(`outcome:${studentId}`);
    if (outcome === "repeating") {
      input.repeating.push({ studentId, classId: Number(form.get(`repeatClass:${studentId}`)) });
    } else if (outcome === "leaving") {
      const lastDay = String(form.get(`lastDay:${studentId}`) ?? "");
      input.leaving.push({ studentId, lastDay: lastDay === "" ? undefined : lastDay });
    }
  }
  try {
    await asCurrentActor((ctx) => promoteClass(ctx, input));
  } catch (err) {
    return { error: refusalKey(err), saved: prev.saved };
  }
  revalidatePath("/admin/year-end");
  redirect("/admin/year-end");
}

export async function closeYear(prev: FormState, form: FormData): Promise<FormState> {
  const academicYearId = Number(form.get("academicYearId"));
  try {
    await asCurrentActor((ctx) => closeAcademicYear(ctx, { academicYearId }));
  } catch (err) {
    return { error: refusalKey(err), saved: prev.saved };
  }
  revalidatePath("/admin/year-end");
  return { saved: prev.saved + 1 };
}

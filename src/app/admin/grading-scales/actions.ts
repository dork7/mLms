"use server";
// Saves a Grade's Grading Scale: read the form, call the layer as the current actor,
// and return the refusal key or revalidate. No rules live here.
import { revalidatePath } from "next/cache";
import { setGradingScale } from "@/core/grading/grading-scales";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import type { FormState } from "@/app/form-kit";

/** The form posts `bandStart` and `bandLabel` once per band, in the same order. */
export async function saveGradingScaleAction(prev: FormState, form: FormData): Promise<FormState> {
  const labels = form.getAll("bandLabel").map(String);
  const starts = form.getAll("bandStart");
  const input = {
    gradeId: Number(form.get("gradeId")),
    passMark: toNumber(form.get("passMark")),
    bands: labels.map((label, i) => ({ minPercent: toNumber(starts[i] ?? null), label })),
  };
  try {
    await asCurrentActor((ctx) => setGradingScale(ctx, input));
  } catch (err) {
    return { error: refusalKey(err), saved: prev.saved };
  }
  revalidatePath("/admin/grading-scales");
  return { saved: prev.saved + 1 };
}

/** A form number; an empty or malformed one becomes NaN, which the layer refuses. */
function toNumber(value: FormDataEntryValue | null): number {
  const text = String(value ?? "").trim();
  return text === "" ? Number.NaN : Number(text);
}

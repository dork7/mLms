"use server";
// The school-wide rank switch: read the form, call the layer as the current actor, and
// return the refusal key or revalidate.
import { revalidatePath } from "next/cache";
import { setRankEnabled } from "@/core/report-cards/rank-setting";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import type { FormState } from "../setup-actions";

export async function saveRankEnabledAction(prev: FormState, form: FormData): Promise<FormState> {
  const enabled = form.get("rankEnabled") === "on";
  try {
    await asCurrentActor((ctx) => setRankEnabled(ctx, enabled));
  } catch (err) {
    return { error: refusalKey(err), saved: prev.saved };
  }
  revalidatePath("/admin/report-cards");
  return { saved: prev.saved + 1 };
}

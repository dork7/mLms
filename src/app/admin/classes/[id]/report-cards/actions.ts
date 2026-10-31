"use server";
// Publish and unpublish: read the form, call the layer as the current actor, and return the
// refusal key or revalidate. Who may do it, and when, is the layer's call.
import { revalidatePath } from "next/cache";
import { publishReportCards, unpublishReportCards } from "@/core/report-cards/publish";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";
import type { FormState } from "../../../setup-actions";

export async function publishAction(prev: FormState, form: FormData): Promise<FormState> {
  return run(prev, form, publishReportCards);
}

export async function unpublishAction(prev: FormState, form: FormData): Promise<FormState> {
  return run(prev, form, unpublishReportCards);
}

async function run(prev: FormState, form: FormData, command: typeof publishReportCards): Promise<FormState> {
  const input = { classId: Number(form.get("classId")), termId: Number(form.get("termId")) };
  try {
    await asCurrentActor((ctx) => command(ctx, input));
  } catch (err) {
    return { error: refusalKey(err), saved: prev.saved };
  }
  revalidatePath(`/admin/classes/${input.classId}/report-cards`);
  return { saved: prev.saved + 1 };
}

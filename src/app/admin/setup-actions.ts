"use server";
// School setup server actions. Each one only reads the form, calls one layer
// command as the current actor, and returns the refusal key or revalidates.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAcademicYear, updateAcademicYear } from "@/core/school/academic-year";
import {
  createGrade,
  createRoom,
  createSubject,
  renameGrade,
  renameRoom,
  renameSubject,
} from "@/core/school/catalogue";
import { setPeriodsPerDay } from "@/core/school/periods";
import type { MessageKey } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";

/** `saved` counts successful saves so a create form knows when to clear itself. */
export type FormState = { error?: MessageKey; saved: number };

export type NamedKind = "grades" | "subjects" | "rooms";

const named = {
  grades: { create: createGrade, rename: renameGrade },
  subjects: { create: createSubject, rename: renameSubject },
  rooms: { create: createRoom, rename: renameRoom },
} as const;

export async function saveNamed(kind: NamedKind, prev: FormState, form: FormData): Promise<FormState> {
  const id = form.get("id");
  const name = String(form.get("name") ?? "");
  try {
    await asCurrentActor((ctx) =>
      id ? named[kind].rename(ctx, { id: Number(id), name }) : named[kind].create(ctx, { name }),
    );
  } catch (err) {
    return { error: refusalKey(err), saved: prev.saved };
  }
  revalidatePath(`/admin/${kind}`);
  return { saved: prev.saved + 1 };
}

export async function saveAcademicYear(prev: FormState, form: FormData): Promise<FormState> {
  const id = form.get("id");
  const names = form.getAll("termName").map(String);
  const starts = form.getAll("termStart").map(String);
  const ends = form.getAll("termEnd").map(String);
  const input = {
    name: String(form.get("name") ?? ""),
    startDate: String(form.get("startDate") ?? ""),
    endDate: String(form.get("endDate") ?? ""),
    terms: names.map((name, i) => ({ name, startDate: starts[i] ?? "", endDate: ends[i] ?? "" })),
  };
  try {
    await asCurrentActor((ctx) =>
      id ? updateAcademicYear(ctx, { id: Number(id), ...input }) : createAcademicYear(ctx, input),
    );
  } catch (err) {
    return { error: refusalKey(err), saved: prev.saved };
  }
  revalidatePath("/admin/academic-years");
  if (id) redirect("/admin/academic-years");
  return { saved: prev.saved + 1 };
}

export async function savePeriodsPerDay(prev: FormState, form: FormData): Promise<FormState> {
  try {
    await asCurrentActor((ctx) => setPeriodsPerDay(ctx, Number(form.get("periodsPerDay"))));
  } catch (err) {
    return { error: refusalKey(err), saved: prev.saved };
  }
  revalidatePath("/admin/periods");
  return { saved: prev.saved + 1 };
}

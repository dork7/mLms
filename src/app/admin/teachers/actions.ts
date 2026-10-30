"use server";
import { revalidatePath } from "next/cache";
import { createTeacher } from "@/core/accounts/create-teacher";
import { disableLogin, enableLogin } from "@/core/accounts/disable-login";
import type { MessageKey } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { messageKeyOf } from "@/web/errors";

type Entered = { name: string; email: string; phone: string };

export type CreateTeacherState = {
  error?: MessageKey;
  entered?: Entered;
  created?: { name: string; initialPassword: string };
};

export async function addTeacher(_prev: CreateTeacherState, form: FormData): Promise<CreateTeacherState> {
  const entered: Entered = {
    name: String(form.get("name") ?? ""),
    email: String(form.get("email") ?? ""),
    phone: String(form.get("phone") ?? ""),
  };
  try {
    const { initialPassword } = await asCurrentActor((ctx) => createTeacher(ctx, entered));
    revalidatePath("/admin/teachers");
    return { created: { name: entered.name.trim(), initialPassword } };
  } catch (err) {
    return { error: messageKeyOf(err), entered };
  }
}

export async function setLoginEnabled(form: FormData): Promise<void> {
  const userId = String(form.get("userId") ?? "");
  const enable = form.get("enable") === "true";
  await asCurrentActor((ctx) => (enable ? enableLogin : disableLogin)(ctx, { userId }));
  revalidatePath("/admin/teachers");
}

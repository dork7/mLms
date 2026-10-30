"use server";
import { revalidatePath } from "next/cache";
import { disableLogin, enableLogin } from "@/core/accounts/disable-login";
import { registerStudent } from "@/core/students/register-student";
import { resetStudentPassword } from "@/core/students/reset-student-password";
import type { MessageKey } from "@/i18n";
import { asCurrentActor } from "@/web/as-current-actor";
import { refusalKey } from "@/web/refusal";

const TEXT_FIELDS = [
  "name",
  "studentNumber",
  "dateOfBirth",
  "nationalId",
  "guardianContact",
  "email",
  "admissionDate",
] as const;

export type Entered = Record<(typeof TEXT_FIELDS)[number], string>;

export type RegisterStudentState = {
  error?: MessageKey;
  entered?: Entered;
  registered?: { name: string; studentNumber: string; initialPassword: string };
};

export async function addStudent(_prev: RegisterStudentState, form: FormData): Promise<RegisterStudentState> {
  const entered = Object.fromEntries(TEXT_FIELDS.map((f) => [f, String(form.get(f) ?? "")])) as Entered;
  const file = form.get("photo");
  try {
    const photo =
      file instanceof File && file.size > 0
        ? { contentType: file.type, data: new Uint8Array(await file.arrayBuffer()) }
        : undefined;
    const { studentNumber, initialPassword } = await asCurrentActor((ctx) =>
      registerStudent(ctx, { ...entered, photo }),
    );
    revalidatePath("/admin/students");
    return { registered: { name: entered.name.trim(), studentNumber, initialPassword } };
  } catch (err) {
    return { error: refusalKey(err), entered };
  }
}

export type ResetState = { error?: MessageKey; newPassword?: string };

export async function resetPassword(_prev: ResetState, form: FormData): Promise<ResetState> {
  const studentId = String(form.get("studentId") ?? "");
  try {
    const { newPassword } = await asCurrentActor((ctx) => resetStudentPassword(ctx, { studentId }));
    revalidatePath(`/admin/students/${studentId}`);
    return { newPassword };
  } catch (err) {
    return { error: refusalKey(err) };
  }
}

export async function setStudentLoginEnabled(form: FormData): Promise<void> {
  const userId = String(form.get("userId") ?? "");
  const enable = form.get("enable") === "true";
  await asCurrentActor((ctx) => (enable ? enableLogin : disableLogin)(ctx, { userId }));
  revalidatePath("/admin/students");
  revalidatePath(`/admin/students/${userId}`);
}

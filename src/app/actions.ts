"use server";
// Login, logout and password server actions. They only call the application layer
// (src/core/accounts), set or clear the session cookie, and render or redirect.
// Server actions that change school data follow `asCurrentActor((ctx) => someCommand(ctx, input))`.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { changePassword } from "@/core/accounts/change-password";
import { logIn } from "@/core/accounts/log-in";
import { requestPasswordReset, resetPassword } from "@/core/accounts/password-reset";
import { logOut } from "@/core/accounts/sessions";
import type { MessageKey } from "@/i18n";
import { asCurrentSessionActor, SESSION_COOKIE } from "@/web/as-current-actor";
import { appDeps } from "@/web/deps";
import { messageKeyOf } from "@/web/errors";

export type LoginState = { error?: MessageKey; identifier?: string };

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const identifier = String(form.get("identifier") ?? "");
  let result;
  try {
    result = await logIn(appDeps(), { identifier, password: String(form.get("password") ?? "") });
  } catch (err) {
    return { error: messageKeyOf(err), identifier };
  }
  (await cookies()).set(SESSION_COOKIE, result.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  redirect(result.mustChangePassword ? "/change-password" : "/");
}

export async function logout(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await logOut(appDeps(), token);
  store.delete(SESSION_COOKIE);
  redirect("/login");
}

export type FormState = { error?: MessageKey; done?: boolean };

export async function changeOwnPassword(_prev: FormState, form: FormData): Promise<FormState> {
  const newPassword = String(form.get("newPassword") ?? "");
  if (newPassword !== String(form.get("confirmPassword") ?? "")) {
    return { error: "changePassword.mismatch" };
  }
  try {
    await asCurrentSessionActor((ctx) =>
      changePassword(ctx, { currentPassword: String(form.get("currentPassword") ?? ""), newPassword }),
    );
  } catch (err) {
    return { error: messageKeyOf(err) };
  }
  redirect("/");
}

export async function forgotPassword(_prev: FormState, form: FormData): Promise<FormState> {
  await requestPasswordReset(appDeps(), {
    email: String(form.get("email") ?? ""),
    linkBase: new URL("/reset-password", appUrl()).toString(),
  });
  return { done: true }; // the same answer whether or not the address exists
}

export async function resetForgottenPassword(_prev: FormState, form: FormData): Promise<FormState> {
  const newPassword = String(form.get("newPassword") ?? "");
  if (newPassword !== String(form.get("confirmPassword") ?? "")) {
    return { error: "changePassword.mismatch" };
  }
  try {
    await resetPassword(appDeps(), { token: String(form.get("token") ?? ""), newPassword });
  } catch (err) {
    return { error: messageKeyOf(err) };
  }
  return { done: true };
}

/** Reset links use the configured URL, never the request's Host header (which can be forged). */
function appUrl(): string {
  return process.env.APP_URL ?? "http://localhost:3000";
}

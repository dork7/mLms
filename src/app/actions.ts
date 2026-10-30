"use server";
// Auth server actions. Login/logout go straight to Better Auth (they are not
// application-layer commands). Server actions that change school data instead
// follow the pattern: `return asCurrentActor((ctx) => someCommand(ctx, input))`.
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { MessageKey } from "@/i18n";
import { auth } from "@/web/auth";

export type LoginState = { error?: MessageKey; email?: string };

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "");
  try {
    await auth().api.signInEmail({
      body: { email, password: String(form.get("password") ?? "") },
      headers: await headers(),
    });
  } catch {
    return { error: "login.invalid", email };
  }
  redirect("/");
}

export async function logout(): Promise<void> {
  await auth().api.signOut({ headers: await headers() });
  redirect("/login");
}

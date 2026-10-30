// Any logged-in person changes their own password. This is how a Teacher replaces
// the initial password the Admin gave them on first login.
import { verifyPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { account } from "@/db/schema";
import type { Ctx } from "../context";
import { InvalidInput } from "../errors";
import { checkNewPassword, setPassword } from "./passwords";

export type ChangePasswordInput = { currentPassword: string; newPassword: string };

export async function changePassword(ctx: Ctx, input: ChangePasswordInput): Promise<void> {
  const userId = ctx.actor.userId; // acts only on the actor's own account
  checkNewPassword(input.newPassword);

  const [found] = await ctx.db
    .select({ hash: account.password })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "credential")))
    .limit(1);
  const ok = !!found?.hash && (await verifyPassword({ hash: found.hash, password: input.currentPassword }));
  if (!ok) throw new InvalidInput("changePassword.wrongCurrent");

  await ctx.db.transaction((tx) => setPassword(tx, ctx.clock.now(), userId, input.newPassword));
}

// Creates the school's first Admin. A system command (no acting person): it runs
// from the seed script on deploy. If an Admin already exists it does nothing.
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { asc, eq, sql } from "drizzle-orm";
import { account, user } from "@/db/schema";
import type { Actor, Deps } from "../context";

export type BootstrapAdminInput = { name: string; email: string; password: string };

export async function bootstrapAdmin(
  { db }: Deps,
  input: BootstrapAdminInput,
): Promise<{ created: boolean; actor: Actor }> {
  const passwordHash = await hashPassword(input.password);

  return db.transaction(async (tx) => {
    // Serialise concurrent bootstraps so only one Admin is ever created.
    await tx.execute(sql`select pg_advisory_xact_lock(1)`);

    const [existing] = await tx
      .select({ id: user.id })
      .from(user)
      .where(eq(user.role, "admin"))
      .orderBy(asc(user.createdAt))
      .limit(1);
    if (existing) return { created: false, actor: { role: "admin", userId: existing.id } };

    const userId = randomUUID();
    await tx.insert(user).values({
      id: userId,
      name: input.name,
      email: input.email.toLowerCase(),
      emailVerified: true,
      role: "admin",
    });
    await tx.insert(account).values({
      id: randomUUID(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: passwordHash,
    });
    return { created: true, actor: { role: "admin", userId } };
  });
}

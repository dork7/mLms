// The Admin creates a Teacher account with a name and an email or phone (or both).
// Returns a generated initial password for the Admin to hand over; the Teacher must
// change it on first login.
import { randomBytes, randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { eq, or } from "drizzle-orm";
import { account, user } from "@/db/schema";
import { requireAdmin } from "../access";
import type { Ctx } from "../context";
import { DuplicateLogin, InvalidInput } from "../errors";
import { normaliseEmail, normalisePhone } from "./identifiers";

export type CreateTeacherInput = { name: string; email?: string; phone?: string };

export async function createTeacher(
  ctx: Ctx,
  input: CreateTeacherInput,
): Promise<{ teacherId: string; initialPassword: string }> {
  requireAdmin(ctx.actor);

  const name = input.name.trim();
  const email = input.email?.trim() ? normaliseEmail(input.email) : null;
  const phone = input.phone?.trim() ? normalisePhone(input.phone) : null;
  if (!name) throw new InvalidInput("errors.nameRequired");
  if (!email && !phone) throw new InvalidInput("errors.emailOrPhoneRequired");

  const initialPassword = generatePassword();
  const passwordHash = await hashPassword(initialPassword);
  const teacherId = randomUUID();

  await ctx.db.transaction(async (tx) => {
    const clashes = [email && eq(user.email, email), phone && eq(user.phone, phone)].filter(
      (c) => !!c,
    );
    const [taken] = await tx
      .select({ id: user.id })
      .from(user)
      .where(or(...clashes))
      .limit(1);
    if (taken) throw new DuplicateLogin();

    const now = ctx.clock.now();
    await tx.insert(user).values({
      id: teacherId,
      name,
      email,
      phone,
      role: "teacher",
      mustChangePassword: true,
      createdAt: now,
      updatedAt: now,
    });
    await tx.insert(account).values({
      id: randomUUID(),
      accountId: teacherId,
      providerId: "credential",
      userId: teacherId,
      password: passwordHash,
      createdAt: now,
      updatedAt: now,
    });
  }).catch((err) => {
    // A concurrent create can still hit the unique constraint.
    if (isUniqueViolation(err)) throw new DuplicateLogin();
    throw err;
  });

  return { teacherId, initialPassword };
}

/** 12 readable characters (no 0/O/1/l/I), easy to read out or copy. */
function generatePassword(): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(randomBytes(12), (b) => alphabet[b % alphabet.length]).join("");
}

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}

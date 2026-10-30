// The Admin resets a Student's password, for Students who can't use the emailed
// reset link (most have no email of their own). Returns a new generated password for
// the Admin to hand over; it ends the Student's sessions and must be changed on login.
import { eq } from "drizzle-orm";
import { session, student, user } from "@/db/schema";
import { requireAdmin } from "../access";
import { generatePassword, setPassword } from "../accounts/passwords";
import type { Ctx } from "../context";
import { NotFound } from "../errors";

export async function resetStudentPassword(
  ctx: Ctx,
  input: { studentId: string },
): Promise<{ newPassword: string }> {
  requireAdmin(ctx.actor);
  const newPassword = generatePassword();
  const now = ctx.clock.now();

  await ctx.db.transaction(async (tx) => {
    const [found] = await tx
      .select({ id: student.userId })
      .from(student)
      .where(eq(student.userId, input.studentId))
      .limit(1);
    if (!found) throw new NotFound("no such Student");

    await setPassword(tx, now, input.studentId, newPassword);
    await tx.update(user).set({ mustChangePassword: true }).where(eq(user.id, input.studentId));
    await tx.delete(session).where(eq(session.userId, input.studentId));
  });
  return { newPassword };
}

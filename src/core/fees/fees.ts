// Fees: what the school charges. The Admin defines a Fee (name, amount in AED, due date).
// Money is whole fils throughout (see money.ts).
import { asc } from "drizzle-orm";
import { fee } from "@/db/schema";
import { requireAdmin } from "../access";
import type { Ctx } from "../context";
import { isCalendarDate } from "../dates";
import { InvalidInput } from "../errors";
import { parseAed } from "./money";

export type FeeRow = { id: number; name: string; amountFils: number; dueDate: string };

/** `amount` is AED as the Admin typed it, e.g. "12,500.50". */
export async function createFee(
  ctx: Ctx,
  input: { name: string; amount: string; dueDate: string },
): Promise<{ id: number }> {
  requireAdmin(ctx.actor);
  const name = input.name.trim();
  if (!name) throw new InvalidInput("errors.feeNameRequired");
  const amountFils = parseAed(input.amount);
  if (amountFils === null) throw new InvalidInput("errors.feeAmountInvalid");
  if (!isCalendarDate(input.dueDate)) throw new InvalidInput("errors.feeDueDateInvalid");
  const [row] = await ctx.db
    .insert(fee)
    .values({ name, amountFils, dueDate: input.dueDate, createdAt: ctx.clock.now() })
    .returning({ id: fee.id });
  return row;
}

/** Every Fee, soonest due first. */
export async function listFees(ctx: Ctx): Promise<FeeRow[]> {
  requireAdmin(ctx.actor);
  return ctx.db
    .select({ id: fee.id, name: fee.name, amountFils: fee.amountFils, dueDate: fee.dueDate })
    .from(fee)
    .orderBy(asc(fee.dueDate), asc(fee.name), asc(fee.id));
}

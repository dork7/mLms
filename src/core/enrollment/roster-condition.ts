// The roster condition: one definition of "this Enrollment covers this date". It imports
// only the schema, so `access.ts` and any query can use it without an import cycle.
import { and, gte, isNull, lte, or, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { enrollment } from "@/db/schema";

/**
 * The Enrollment covers `date` (a YYYY-MM-DD string, or a date column such as an
 * Assessment's). Ranges are inclusive at both ends and an open Enrollment has no end.
 */
export function enrollmentCovers(date: string | AnyPgColumn): SQL {
  return and(lte(enrollment.startDate, date), or(isNull(enrollment.endDate), gte(enrollment.endDate, date)))!;
}

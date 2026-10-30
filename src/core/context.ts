// What every command and query receives.
//
//   Deps  = what the layer runs on: the database, the Clock and the Mailer.
//   Actor = the acting person (Admin, Teacher or Student).
//   Ctx   = Deps + Actor. Commands and queries take `ctx` first, then their input:
//
//     export async function doThing(ctx: Ctx, input: DoThingInput): Promise<Result>
//
// The layer is framework-independent: nothing under src/core imports Next.js.
import type { Db } from "@/db/client";
import type { Clock } from "./clock";
import type { Mailer } from "./mailer";

export type Role = "admin" | "teacher" | "student";

export type Actor = { role: Role; userId: string };

export type Deps = { db: Db; clock: Clock; mailer: Mailer };

export type Ctx = Deps & { actor: Actor };

export function as(deps: Deps, actor: Actor): Ctx {
  return { ...deps, actor };
}

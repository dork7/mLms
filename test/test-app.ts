// The one test helper for the application layer.
//
//   const app = await testApp({ now: "2026-09-01T08:00:00+04:00" });
//   const admin = await app.seedAdmin();
//   const result = await someQuery(app.as(admin), input);
//
// Every call gets a brand-new, migrated database, a fixed Clock and a recording Mailer.
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { inject, onTestFinished } from "vitest";
import { bootstrapAdmin } from "@/core/accounts/bootstrap-admin";
import { fixedClock } from "@/core/clock";
import { as, type Actor, type Deps } from "@/core/context";
import { recordingMailer } from "@/core/mailer";
import { createDb } from "@/db/client";
import { TEMPLATE_DB } from "./global-setup";

export async function testApp(opts: { now?: string } = {}) {
  const url = await createFreshDatabase();
  const db = createDb(url);
  onTestFinished(() => db.$client.end());

  const clock = fixedClock(opts.now ?? "2026-09-01T08:00:00+04:00");
  const mailer = recordingMailer();
  const deps: Deps = { db, clock, mailer };

  return {
    deps,
    clock,
    mailer,
    as: (actor: Actor) => as(deps, actor),
    async seedAdmin(name = "Amina Office"): Promise<Actor> {
      const { actor } = await bootstrapAdmin(deps, {
        name,
        email: `admin-${randomUUID()}@school.test`,
        password: "correct horse battery",
      });
      return actor;
    },
  };
}

async function createFreshDatabase(): Promise<string> {
  const adminUrl = inject("adminDatabaseUrl");
  const name = `t_${randomUUID().replaceAll("-", "")}`;
  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    // Parallel clones of one template can collide; retry briefly.
    for (let attempt = 0; ; attempt++) {
      try {
        await client.query(`CREATE DATABASE ${name} TEMPLATE ${TEMPLATE_DB}`);
        break;
      } catch (err) {
        if (attempt >= 20 || !String(err).includes("being accessed by other users")) throw err;
        await new Promise((r) => setTimeout(r, 50 + Math.random() * 100));
      }
    }
  } finally {
    await client.end();
  }
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  return url.toString();
}

// Creates the first Admin if none exists (safe to run repeatedly).
// Configure with ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD.
import { bootstrapAdmin } from "../src/core/accounts/bootstrap-admin";
import { systemClock } from "../src/core/clock";
import { consoleMailer } from "../src/core/mailer";
import { createDb } from "../src/db/client";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const db = createDb(url);
const { created } = await bootstrapAdmin(
  { db, clock: systemClock(), mailer: consoleMailer() },
  {
    name: process.env.ADMIN_NAME ?? "School Admin",
    email: process.env.ADMIN_EMAIL ?? "admin@school.test",
    password: process.env.ADMIN_PASSWORD ?? "admin-password",
  },
);
await db.$client.end();
console.info(created ? "seeded the first Admin" : "an Admin already exists; nothing seeded");

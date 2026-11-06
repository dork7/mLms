// Migrations against data that already exists. This is the one test that writes and reads
// tables directly: the layer of today can't build a database as it was before a migration.
import { randomUUID } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import { describe, expect, inject, it, onTestFinished } from "vitest";
import { fixedClock } from "@/core/clock";
import { as } from "@/core/context";
import { recordingMailer } from "@/core/mailer";
import { listGradesInOrder } from "@/core/school/catalogue";
import { createDb, migrateDb } from "./client";

/** A new empty database, migrated only up to and including `lastTag`. */
async function databaseMigratedTo(lastTag: string) {
  const name = `migration_${randomUUID().replaceAll("-", "")}`;
  const admin = new Client({ connectionString: inject("adminDatabaseUrl") });
  await admin.connect();
  await admin.query(`create database ${name}`);
  await admin.end();
  const url = new URL(inject("adminDatabaseUrl"));
  url.pathname = `/${name}`;
  const db = createDb(url.toString());
  onTestFinished(() => db.$client.end());

  const folder = mkdtempSync(path.join(tmpdir(), "lms-migrations-"));
  onTestFinished(() => rmSync(folder, { recursive: true, force: true }));
  cpSync(path.join(process.cwd(), "drizzle"), folder, { recursive: true });
  const journalPath = path.join(folder, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as { entries: { tag: string }[] };
  const last = journal.entries.findIndex((e) => e.tag === lastTag);
  expect(last).toBeGreaterThanOrEqual(0);
  journal.entries = journal.entries.slice(0, last + 1);
  writeFileSync(journalPath, JSON.stringify(journal));
  await migrate(db, { migrationsFolder: folder });
  return db;
}

describe("migrating a school that already has data", () => {
  it("leaves existing Grades with no order, and keeps a snapshot of the Scales of years already Closed", async () => {
    const db = await databaseMigratedTo("0012_publish");
    const sql = (text: string) => db.$client.query(text);
    await sql(`insert into "user" (id, name, role) values ('t1', 'Huda', 'teacher')`);
    await sql(`insert into grade (id, name) values (7, 'Grade 7'), (8, 'Grade 8'), (9, 'Grade 9'), (10, 'Grade 10')`);
    await sql(`insert into academic_year (id, name, start_date, end_date, closed_at) values
      (1, '2024-2025', '2024-09-01', '2025-06-30', '2025-07-01T00:00:00Z'),
      (2, '2025-2026', '2025-09-01', '2026-06-30', null)`);
    await sql(`insert into class (id, academic_year_id, grade_id, name, class_teacher_id) values
      (1, 1, 7, '7-A', 't1'), (2, 1, 7, '7-B', 't1'), (3, 1, 10, '10-A', 't1'), (4, 2, 8, '8-A', 't1')`);
    await sql(`insert into grading_scale (grade_id, pass_mark) values (7, 50), (8, 60), (9, 70)`);
    await sql(`insert into grading_band (grade_id, min_percent, label) values
      (7, 0, 'F'), (7, 75.5, 'A'), (8, 0, 'Low'), (9, 0, 'None')`);

    await migrateDb(db);

    const asAdmin = as(
      { db, clock: fixedClock("2026-01-01T08:00:00+04:00"), mailer: recordingMailer() },
      { role: "admin", userId: "a1" },
    );
    expect(await listGradesInOrder(asAdmin)).toEqual([
      { id: 10, name: "Grade 10", order: null },
      { id: 7, name: "Grade 7", order: null },
      { id: 8, name: "Grade 8", order: null },
      { id: 9, name: "Grade 9", order: null },
    ]);

    // One row for the Closed year's Grade with Classes and a Scale. Not Grade 10 (no Scale),
    // Grade 8 (its Class is in the open year) or Grade 9 (no Class in the Closed year).
    const { rows } = await sql(`select academic_year_id, grade_id, pass_mark, bands from closed_year_scale`);
    expect(rows).toEqual([
      {
        academic_year_id: 1,
        grade_id: 7,
        pass_mark: "50.00",
        bands: [
          { minPercent: 75.5, label: "A" },
          { minPercent: 0, label: "F" },
        ],
      },
    ]);
  });
});

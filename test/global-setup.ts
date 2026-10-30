// Runs once per `npm test`: starts a throwaway Postgres in Docker and migrates a
// template database. Each test then clones the template (see test/test-app.ts).
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import type { TestProject } from "vitest/node";
import { createDb, migrateDb } from "../src/db/client";

export const TEMPLATE_DB = "lms_template";

declare module "vitest" {
  export interface ProvidedContext {
    /** Connection URL to the server's maintenance database (for CREATE DATABASE). */
    adminDatabaseUrl: string;
  }
}

let container: StartedPostgreSqlContainer | undefined;

export async function setup(project: TestProject) {
  container = await new PostgreSqlContainer("postgres:17-alpine")
    .withDatabase(TEMPLATE_DB)
    .start();

  const template = createDb(container.getConnectionUri());
  await migrateDb(template);
  await template.$client.end();

  const adminUrl = new URL(container.getConnectionUri());
  adminUrl.pathname = "/postgres";
  project.provide("adminDatabaseUrl", adminUrl.toString());
}

export async function teardown() {
  await container?.stop();
}

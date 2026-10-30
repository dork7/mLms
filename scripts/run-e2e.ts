// `npm run test:e2e`: starts a throwaway Postgres, migrates and seeds it, then runs
// Playwright against `next dev` on a free port. Extra args pass through to Playwright.
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { bootstrapAdmin } from "../src/core/accounts/bootstrap-admin";
import { systemClock } from "../src/core/clock";
import { consoleMailer } from "../src/core/mailer";
import { createDb, migrateDb } from "../src/db/client";

const admin = { name: "E2E Admin", email: "e2e-admin@school.test", password: "e2e-admin-password" };

const container = await new PostgreSqlContainer("postgres:17-alpine").start();
let exitCode = 1;
try {
  const databaseUrl = container.getConnectionUri();
  const db = createDb(databaseUrl);
  await migrateDb(db);
  await bootstrapAdmin({ db, clock: systemClock(), mailer: consoleMailer() }, admin);
  await db.$client.end();

  const port = await freePort();
  exitCode = await run("npx", ["playwright", "test", ...process.argv.slice(2)], {
    ...process.env,
    DATABASE_URL: databaseUrl,
    PORT: String(port),
    APP_URL: `http://localhost:${port}`,
    E2E_ADMIN_EMAIL: admin.email,
    E2E_ADMIN_PASSWORD: admin.password,
  });
} finally {
  await container.stop();
}
process.exit(exitCode);

function run(cmd: string, args: string[], env: NodeJS.ProcessEnv): Promise<number> {
  return new Promise((resolve) => {
    spawn(cmd, args, { stdio: "inherit", env }).on("exit", (code) => resolve(code ?? 1));
  });
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, () => {
      const address = server.address();
      server.close(() => (typeof address === "object" && address ? resolve(address.port) : reject()));
    });
  });
}

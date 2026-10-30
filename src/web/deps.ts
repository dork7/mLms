// Production wiring of the application layer's dependencies. Server-only.
import "server-only";
import { systemClock } from "@/core/clock";
import type { Deps } from "@/core/context";
import { consoleMailer, smtpMailer } from "@/core/mailer";
import { createDb } from "@/db/client";

const globalForDeps = globalThis as unknown as { lmsDeps?: Deps };

export function appDeps(): Deps {
  globalForDeps.lmsDeps ??= {
    db: createDb(requireEnv("DATABASE_URL")),
    clock: systemClock(),
    mailer: process.env.SMTP_URL
      ? smtpMailer(process.env.SMTP_URL, process.env.MAIL_FROM ?? "School LMS <no-reply@localhost>")
      : consoleMailer(),
  };
  return globalForDeps.lmsDeps;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

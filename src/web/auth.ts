// Better Auth: login, sessions and password hashing. Server-only.
// Accounts are created by the application layer (no self sign-up).
import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import * as schema from "@/db/schema";
import { appDeps } from "./deps";

function createAuth() {
  return betterAuth({
    database: drizzleAdapter(appDeps().db, { provider: "pg", schema }),
    emailAndPassword: { enabled: true, disableSignUp: true },
    user: {
      additionalFields: {
        role: { type: "string", required: true, input: false },
      },
    },
    advanced: { database: { generateId: () => crypto.randomUUID() } },
    plugins: [nextCookies()],
  });
}

const globalForAuth = globalThis as unknown as { lmsAuth?: ReturnType<typeof createAuth> };

export function auth() {
  globalForAuth.lmsAuth ??= createAuth();
  return globalForAuth.lmsAuth;
}

// Secret tokens (sessions, reset links). The raw token goes to the person; the
// database stores only its SHA-256, so a leaked table can't be replayed.
import { createHash, randomBytes } from "node:crypto";

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

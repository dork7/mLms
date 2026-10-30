## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues on `dork7/mLms` using the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Commands

- `npm test`: application-layer tests (Vitest). Each test gets a fresh, migrated Postgres database in Docker (testcontainers). Docker must be running.
- `npm run test:e2e`: Playwright smoke tests against `next dev` on a throwaway database.
- `npm run test:all`: both of the above.
- `npm run typecheck`: `tsc --noEmit`.
- `npm run dev`: starts the `db` service with Docker Compose, migrates, seeds the first Admin, and runs `next dev`. Copy `.env.example` to `.env` first.
- `docker compose up --build`: the full stack (app and Postgres). Requires `BETTER_AUTH_SECRET`.
- `npm run db:generate`: writes a migration into `drizzle/` after editing `src/db/schema.ts`.

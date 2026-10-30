# 01: Walking skeleton

**What to build:** An Admin can log in to a running app and see an empty Admin dashboard. Under it are the Next.js, Postgres, Drizzle and Docker Compose stack (ADR 0002) and the application layer that every later ticket builds on. The layer takes an acting person and has an injected Clock and Mailer. The test harness runs the layer against a real Postgres database.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Starting the app with Docker Compose brings up the app and Postgres, and migrations run
- [ ] A seeded Admin can log in and sees an Admin dashboard
- [ ] The application layer is independent of Next.js. Server actions and route handlers only authenticate, call it and render
- [ ] The application layer receives a Clock and a Mailer. Tests use a fixed Clock and a Mailer that records messages
- [ ] One test command runs application-layer tests against a throwaway Postgres database with migrations applied
- [ ] UI text comes from translation keys (English only), and CSS uses logical (direction-neutral) properties
- [ ] A Playwright smoke test logs in through the real UI

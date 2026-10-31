# Handoff: School LMS P1 build (implement-spec in progress)

Repo: the `glassfish` worktree at `/Users/hamza/orca/workspaces/mLMS/glassfish`. The main checkout is at `/Users/hamza/orca/projects/mLMS`. The remote `origin` is `https://github.com/dork7/mLms.git`; only `main` (the initial commit) has been pushed.

## Read these first (don't duplicate them)
- `AGENTS.md`: agent-skills config and the Commands section (test, typecheck, dev).
- `GLOSSARY.md`: domain vocabulary. Use these terms.
- `docs/adr/0001-single-school-per-deployment.md` and `docs/adr/0002-nextjs-postgres-stack.md`. ADR 0002 is **amended**: login and sessions live in the application layer, and Better Auth only hashes passwords.
- `.scratch/school-lms/spec.md`: the full spec, with its stories tagged [P1] and [P2].
- `.scratch/school-lms/issues/NN-*.md`: 23 tickets, each with a `Blocked by` line and a `**Status:**` line.
- `docs/handoff/conventions.md`: the code conventions every implementer must follow. It's a copy of the session scratchpad note at `/private/tmp/claude-501/.../scratchpad/notes/conventions.md`. Implementers should now append to this repo copy instead of the scratchpad note.
- `docs/backups.md`: backup and restore.

## Where the build stands
- **Integration branch:** `integration/school-lms-p1`, checked out in the glassfish worktree at `d8be985`. It is not pushed.
- **Merged and resolved:** 01, 02, 03, 04, 05, 06, 07 and 17. The last full run on the integration branch was green: the typecheck, 117 Vitest tests and 8 Playwright tests.
- **Ticket 08 (Assessments and marks grid)** was stopped by the user just before its final checks. Its work is **uncommitted**, about 20 files, in worktree `/Users/hamza/orca/projects/mLMS/.claude/worktrees/agent-a2aab4caa129e8c2a` on branch `ticket/08-assessments-and-marks`. Its new e2e test had passed, but the full typecheck and `npm run test:all` had not been run yet. The user hasn't said whether to resume it, restart it, or leave it.
- **Remaining P1 tickets, all blocked on 08:**
  - 09 → 10 → 11 → 12 / 15
  - 13 (needs 03 and 08) → 14
  - 16 (needs 06, 07, 08 and 13)
- **Out of this run:** P2 tickets 18–23. The user chose P1 only.

## Decisions made in conversation (not recorded elsewhere)
- **Scope:** this run covers P1 only (tickets 01–17).
- **Tickets are tracked as local files for now.** `AGENTS.md` and `docs/agents/issue-tracker.md` already point at GitHub Issues (`dork7/mLms`), but `gh` is **not logged in**. Once the user runs `gh auth login`, the plan is:
  - create the triage labels
  - create the spec as a parent issue
  - create the 23 tickets as sub-issues with native "blocked by" links
  - delete `.scratch/school-lms/`
  - commit, and push `glassfish` and the integration branch.
- **One test seam:** the application layer, called as a specific Admin, Teacher or Student, against real Postgres in Docker (testcontainers). Only the Clock and Mailer are faked. The user approved this.
- **Every ticket is a full vertical slice, including its UI pages.** Ticket 03 initially shipped without UI and was sent back.
- **Access to Marks comes from the Class Subject, not the Student's current Class.** Ticket 06 grants profile access by the Student's Class *today*; that rule doesn't apply to Marks. Ticket 08's instructions included an Aisha-scenario test: her 7-A Mark stays visible to and editable by 7-A's Subject Teacher after she moves to 7-B.
- **Watch for in 08 and later:** ticket 03's `updateAcademicYear` replaces all of a year's Terms. Each Assessment's Term is worked out from its date, so that's probably fine, but check it.

## How the orchestration ran
- **One implementer subagent per ticket**, in its own worktree with a `ticket/NN-slug` branch. Each read its ticket and the conventions note, used `mattpocock-skills:tdd`, ran the typecheck and `npm run test:all`, ticked its ticket and set it `resolved`, committed with the Co-Authored-By trailer, and merged the integration tip into its branch.
- **Merging into integration:** done inline with `git merge`, since there were no conflicts. Drizzle migration clashes were handled by the implementers regenerating theirs on top of the integration branch's migrations, which run 0000–0006 so far.
- **Environment:**
  - Docker Desktop must be running; start it with `open -a Docker`.
  - Node 25 and npm are installed; there's no pnpm.
  - Docker-backed tests may need the sandbox disabled.
  - `docker compose run` was blocked in the sandbox.
- **Leftover worktrees:** one per finished ticket (see `git worktree list`). The skill's last step cleans them all up.

## Next steps
1. Ask the user what to do about ticket 08: resume (run the checks in its worktree, then commit and merge), restart, or pause.
2. Keep working the frontier as tickets unblock.
3. When P1 is done, run `code-review` on the integration branch and fix everything it finds in one implementer.
4. Resolve the tickets, report, and clean up the worktrees.
5. Remind the user about `gh auth login` and the GitHub migration, and about pushing.

## Suggested skills
- `mattpocock-skills:implement-spec`: continue the orchestration from the current frontier.
- `mattpocock-skills:tdd`: implementers call this for each ticket.
- `mattpocock-skills:code-review`: run on the integration branch once P1 is complete.
- `mattpocock-skills:domain-modeling`: if new terms come up, update `GLOSSARY.md`.
- `mattpocock-skills:pr`: when the integration branch goes up as a PR.

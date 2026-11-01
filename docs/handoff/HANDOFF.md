# Handoff: School LMS build (P1 complete)

Repo: `https://github.com/dork7/mLms.git`. The main checkout is at `/Users/dork/repos/mLms` (on `main`), and `integration/school-lms-p1` is checked out in the worktree `/Users/dork/orca/workspaces/mLms/gannet`.

## Read these first (don't duplicate them)
- `AGENTS.md`: agent-skills config and the Commands section (test, typecheck, dev).
- `GLOSSARY.md`: domain vocabulary. Use these terms.
- `docs/adr/0001-single-school-per-deployment.md` and `docs/adr/0002-nextjs-postgres-stack.md`. ADR 0002 is **amended**: login and sessions live in the application layer, and Better Auth only hashes passwords.
- `.scratch/school-lms/spec.md`: the full spec, with its stories tagged [P1] and [P2].
- `.scratch/school-lms/issues/NN-*.md`: 23 tickets, each with a `Blocked by` line and a `**Status:**` line.
- `docs/handoff/conventions.md`: the code conventions every implementer must follow, with a section per ticket and one for the P1 review fixes. Append to it.
- `docs/backups.md`: backup and restore.

## Where the build stands
- **P1 (tickets 01–17) is resolved** and merged on `integration/school-lms-p1`, including the code review fixes (branch `review/p1-fixes`). The last run, on `3cf7a06`, was green: the typecheck, 483 Vitest tests and 21 Playwright tests.
- **Dark mode** (`76a4450`) is also on the integration branch. It came from outside the implement-spec run and has no ticket.
- **P2 (tickets 18–23) isn't started**; all are still `ready-for-agent`. The user chose P1 only for the last run, so ask before starting them. Every blocker is resolved except 18, so 18, 22 and 23 are ready now, and 19, 20 and 21 follow 18.
- **Migrations** run 0000–0014.
- **Local branches kept:** `ticket/08` to `ticket/16` and `review/p1-fixes`, all merged. The implementer worktrees are gone.

## Not done yet
- **The PR:** `integration/school-lms-p1` is pushed and a PR into `main` is open (`gh pr view integration/school-lms-p1`). `main` is still at `e68a933` until it merges.
- **GitHub Issues:** `AGENTS.md` and `docs/agents/issue-tracker.md` point at GitHub Issues on `dork7/mLms`, but tickets are still local files and GitHub has none. `gh` is logged in now. The plan, which the user hasn't yet asked to run:
  - create the triage labels
  - create the spec as a parent issue
  - create the 23 tickets as sub-issues with native "blocked by" links
  - delete `.scratch/school-lms/`
- **Untracked folders:** `designs/` and `screenshots/` are in the gannet worktree. They didn't come from the implement-spec run, so leave them to the user.

## Questions waiting on the user
1. **Should an Admin enter Marks and remarks?** The spec says an Admin can "act on everything", but the stories name Teachers. It's Teacher-only for now.
2. **Should Students see Term Grades before Publish?** They can now; only the Report Card waits for Publish.
3. **Is the unrequested behaviour acceptable?** All of it was kept:
   - Publish also freezes remarks, Enrollment moves and Term dates.
   - Published cards are stored as snapshots.
   - The Admin can export draft PDFs, marked as drafts.
   - The preview lists Students with no Report Card.
   - A Leaving Student can have an earlier last day.
4. **Do Exams need editing?** They can't be edited, moved or deleted yet, so an Admin can't fix a mistake. It needs its own ticket.

## Decisions made in conversation (not recorded elsewhere)
- **Tickets are tracked as local files for now**, resolved by ticking the boxes and setting `**Status:** resolved`.
- **One test seam:** the application layer, called as a specific Admin, Teacher or Student, against real Postgres in Docker (testcontainers). Only the Clock and Mailer are faked. The user approved this.
- **Every ticket is a full vertical slice, including its UI pages.**
- **Access to Marks comes from the Class Subject, not the Student's current Class.**
- **`registerStudent` isn't Closed-year guarded, on purpose:** a Student admitted years ago can have an admission date in a Closed year.

## Before deploying
- **Migrations touch existing data:**
  - `0013` leaves existing Grades with no order, and promotion from or into them is refused until an Admin sets one.
  - `0014` fills already-Closed years' label snapshots from the current Scale, so any Scale edit made since they Closed can't be undone. Check this first if Scales have changed.
- **Docker image:** it moved from Alpine to `node:24-bookworm-slim` for Chromium. The Compose stack was last built and tested before ticket 15 and the review fixes were merged, so rebuild it once.
- **Known PDF gaps:** Chromium runs as root with its sandbox off, concurrent renders aren't limited, and Arabic text prints in a crude fallback font.

## Known test gaps
- **Load-related Playwright failures:** the suite failed repeatedly at login and on timeouts while the machine was overloaded (load above 100), and passed at default workers once it wasn't. It may flake on a busy CI machine.
- **Showing an actual next Exam** on the Student dashboard is tested at the layer only.
- **The `moveStudent` Closed-year guard** has no test of its own, because only a race with Closing can reach it.

## How the orchestration ran
- **One implementer subagent per ticket**, in its own worktree on a `ticket/NN-slug` branch. Each read its ticket and the conventions, used the `tdd` skill, ran the typecheck and `npm run test:all`, ticked its ticket and set it `resolved`, committed with the Co-Authored-By trailer, and merged the integration tip into its branch.
- **Merging:** one merger subagent at a time, using `git merge --no-ff` in the gannet worktree. Parallel tickets can clash on Drizzle migration numbers, and the later one regenerates on top.
- **Worktree base:** new worktrees can start from an older commit, so each implementer must confirm its base and reset onto the integration branch.
- **Environment:**
  - Docker Desktop must be running; start it with `open -a Docker`. It has stopped mid-run before.
  - Node and npm are installed; there's no pnpm.
  - Docker-backed tests may need the sandbox disabled.
  - A new worktree needs `npm ci` and `npx playwright install chromium`.
- **e2e data:** specs share one database in parallel, so grep `e2e/` before choosing a year, Grade, Subject or login email.

## Next steps
1. Get answers to the questions above.
2. Review and merge the PR into `main` when the user asks.
3. Migrate the tickets to GitHub Issues if the user wants that.
4. Start P2 if the user wants it, working from the frontier above.

## Suggested skills
- `implement-spec`: continue with P2 from the current frontier.
- `tdd`: implementers call this for each ticket.
- `code-review`: run on the integration branch after P2. The P1 review used `e68a933` as its fixed point.
- `domain-modeling`: if new terms come up, update `GLOSSARY.md`.
- `pr`: for any later PR, such as P2.

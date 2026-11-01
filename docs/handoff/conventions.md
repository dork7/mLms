# School LMS: conventions (set by ticket 01)

Branch `ticket/01-walking-skeleton`. Read `GLOSSARY.md`, `docs/adr/` and the spec's Testing Decisions first.

## Where things live

- `src/core/`: the application layer. It is framework-independent: never import `next/*` here.
  - `context.ts`: `Actor` {role, userId}, `Deps` {db, clock, mailer}, `Ctx` = Deps + actor, `as(deps, actor)`.
  - `access.ts`: the one access policy (`requireAdmin`, `requireRole`). Add new rules here, not in commands or UI.
  - `errors.ts`: `AccessDenied`, which carries a `messageKey`. Add new refusal errors the same way.
  - `clock.ts`: `systemClock()` and `fixedClock(iso)` (with `.set()`). Use `ctx.clock.today()` / `now()`, never `new Date()`.
  - `mailer.ts`: `smtpMailer`, `consoleMailer` (dev) and `recordingMailer` (tests, with `.sent`).
  - `<module>/<command>.ts`, e.g. `dashboard/admin-dashboard.ts` and `accounts/bootstrap-admin.ts`, with the test beside it as `*.test.ts`.
- `src/db/schema.ts`: all Drizzle tables. Better Auth tables are `user`/`session`/`account`/`verification`, and `user.role` is an enum. `src/db/client.ts`: `createDb`, `migrateDb`. Migrations are in `drizzle/`.
- `src/web/`: Next-only glue. `deps.ts` (production Deps), `auth.ts` (Better Auth: email+password, no sign-up, `nextCookies`), `as-current-actor.ts`.
- `src/app/`: App Router pages and server actions. `actions.ts` holds login and logout.
- `src/i18n/`: `en.ts` (all UI text) and `index.ts` (`t(key, params)`, `locale`, `dir`).
- `test/`: `global-setup.ts` (Postgres container and migrated template DB) and `test-app.ts` (`testApp()`).
- `e2e/`: Playwright specs. `scripts/run-e2e.ts` provides the DB, seeds an Admin (`E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD`) and picks a free port.
- `scripts/migrate.ts` and `scripts/seed.ts` (idempotent first Admin from `ADMIN_*` env). `Dockerfile` and `compose.yaml` (db + app).

## Adding a command or query

1. Create `src/core/<module>/<name>.ts`: `export async function name(ctx: Ctx, input: Input): Promise<Result>`.
2. First line: an access guard from `access.ts` (extend it if needed). Use `ctx.db` (Drizzle) directly. Use `ctx.db.transaction` for multi-row writes.
3. If it changes the schema, edit `src/db/schema.ts`, then run `npm run db:generate -- --name <what>` and commit the SQL.
4. Expected refusals throw an error class from `errors.ts` with a `messageKey`.
5. System commands with no acting person (seed, cron jobs) take `Deps` instead of `Ctx` (see `bootstrapAdmin`).

## Calling it from Next.js

- In a page or server action: `const result = await asCurrentActor((ctx) => myQuery(ctx, input));`. It redirects to /login when there is no session. Catch `AccessDenied` and render `t(err.messageKey)` (see `src/app/admin/page.tsx`).
- Server actions only authenticate, call the layer and render or redirect. No business logic and no access checks in UI code.
- Call `await headers()` (done in `currentActor`) before anything that touches the DB, or Next tries to prerender the route at build time.

## Writing a test

```ts
import { testApp } from "../../../test/test-app";
const app = await testApp({ now: "2026-09-01T08:00:00+04:00" }); // fresh DB, fixed Clock, recording Mailer
const admin = await app.seedAdmin();
const result = await myQuery(app.as(admin), input);
await expect(myQuery(app.as(teacher), input)).rejects.toThrow(AccessDenied);
app.clock.set("2026-10-01T08:00:00+04:00"); // move time
expect(app.mailer.sent).toEqual([...]);
```

- Set up state only through layer commands. Never query tables in tests.
- Name tests with glossary terms, as scenarios ("a Teacher is refused another Teacher's Class Subject").
- Each `testApp()` clones a migrated template DB (~tens of ms), so tests are isolated and run in parallel.
- Until ticket 02 adds Teacher creation, a non-Admin actor can be a literal `{ role: "teacher", userId: "x" }`.

## Translation and CSS

- All UI text comes from `t("section.key", { param })`. Add keys to `src/i18n/en.ts`, and key typos fail the typecheck. Client components can import `t` too.
- `<html lang dir>` comes from `src/i18n`. CSS is plain `src/app/globals.css` using logical properties only (`margin-inline`, `padding-block`, `inset-inline-start`, `text-align: start`). Never use left/right.

## Commands

- `npm test`: Vitest application-layer tests (needs Docker).
- `npm run test:e2e`: Playwright smoke tests (needs Docker; run `npx playwright install chromium` once).
- `npm run test:all`: both.
- `npm run typecheck`
- `npm run dev`: run `cp .env.example .env` first. It starts the compose `db`, migrates, seeds, then runs `next dev`.
- `docker compose up --build`: the full stack. Set `APP_URL` (public URL for reset emails; `BETTER_AUTH_*` env vars are gone since ticket 02). Default Admin is admin@school.test / admin-password.

## Gotchas

- Vitest 5.0.5 warns about Node 25 (EBADENGINE) but works.
- TypeScript is pinned to 6.0.3, not 7.x, because Next's build uses the TS JS API.
- React 19 resets uncontrolled forms after a server action. Return entered values in the action state if a form must keep them (see `login-form.tsx`).

## Added by ticket 03 (school setup)

- School structure lives in `src/core/school/`: `academic-year.ts` (`createAcademicYear`, `termOn(ctx, "YYYY-MM-DD")` -> Term or null), `catalogue.ts` (`create/rename/list` for Grade, Subject, Room; ids are `serial` integers), `periods.ts` (`setPeriodsPerDay`, `getPeriodsPerDay` -> N or null).
- Calendar dates are Postgres `date` columns with `{ mode: "string" }` (YYYY-MM-DD), ranges inclusive at both ends. Compare them as strings.
- To derive an Assessment's Term, call `termOn` (or reuse its query); never store the Term.
- School-wide settings go in the one-row `school_settings` table (id = 1, upsert). Add columns there (e.g. rank on/off) rather than new settings tables.
- Unique-name refusals: catch with `isUniqueViolation(err)` from `errors.ts` and throw `NameTaken`. Missing ids on edit throw `NotFound`. Both have `messageKey`s.
- Read queries (`list*`, `termOn`, `getPeriodsPerDay`) are open to staff (and `termOn` to Students); writes are Admin-only.
- Tickets are vertical slices: ship the Admin/Teacher pages and a Playwright smoke test with the layer.
- `updateAcademicYear` replaces a year's Terms (Term ids change), so never store a Term id; derive it with `termOn`. `getSchoolSetup` is the Admin-only query behind the setup pages.
- UI pattern from ticket 03 (`src/app/admin/`):
  - Server actions in a `"use server"` file return `FormState = { error?: MessageKey; saved: number }`. They call one layer command inside `asCurrentActor`, catch with `refusalKey(err)` from `src/web/refusal.ts` (it returns any layer error's `messageKey` and rethrows everything else, including Next redirects), then `revalidatePath`. Call `redirect()` outside the try.
  - Client forms use `useActionState` with controlled inputs so values survive a refusal. A create form clears itself when `state.saved` changes.
  - `SetupPage` (`setup-shell.tsx`) loads data through the layer and renders `t(refusalKey(err))` for non-Admins. Copy it for other areas.
  - In Playwright, `getByRole("alert")` also matches Next's route announcer, so filter by text.

## Added by ticket 02 (staff accounts)

- **Login and sessions belong to the application layer now** (`src/core/accounts/`), not Better Auth. Better Auth's runtime, `src/web/auth.ts` and `/api/auth` are gone. Its table shapes and `better-auth/crypto` hashing (`hashPassword`/`verifyPassword`) stay. The reason: session timeout, rate-limiting and disabled logins must use the Clock and be testable at the layer seam.
  - `logIn(deps, { identifier, password })` → `{ token, actor, mustChangePassword }`. Identifier is an email (contains "@") or phone (normalised by `identifiers.ts`). Throws `LoginFailed` (wrong password, unknown or disabled: deliberately identical) or `TooManyLoginAttempts` (5 failures per identifier in 15 min).
  - `sessionActor(deps, token)` → `{ actor, mustChangePassword } | null`. Idle timeout 8 h, sliding. Tokens are stored as SHA-256 (`tokens.ts`).
  - `changePassword(ctx, ...)`, `requestPasswordReset(deps, { email, linkBase })` (mails a 1-hour single-use link), `resetPassword(deps, { token, newPassword })` (ends all sessions). Min password length 10 (`passwords.ts`).
  - `createTeacher(ctx, { name, email?, phone? })` → `{ teacherId, initialPassword }` (Admin-only, sets must-change). `disableLogin`/`enableLogin` (Admin-only; disabling ends sessions, keeps every record). `listTeachers(ctx)`.
- **Students (ticket 05)**: `user.email` is nullable and `user.phone` exists. Students log in by Student Number: extend `parseIdentifier`/`logIn` rather than writing a second login path. Reuse `setPassword` (and set `mustChangePassword: true`) for the Admin-initiated Student reset, and `disableLogin` for disabling Students.
- **In tests**, get a real Teacher with `createTeacher(app.as(admin), {...})`; its `teacherId` is the Teacher's `userId`, so `app.as({ role: "teacher", userId: teacherId })` works without logging in.
- **Web**: the session cookie is `lms_session` (set in `src/app/actions.ts`). `asCurrentActor` redirects to `/login` without a session and to `/change-password` while the initial password is unchanged. `currentSession()` for pages that must allow that state. Teachers land on `/teacher` (placeholder until the dashboards ticket).
- New errors in `errors.ts`: `InvalidInput(messageKey)` (generic validation refusal, pass the key), `DuplicateLogin`, `LoginFailed`, `TooManyLoginAttempts`, `InvalidResetToken`.
- Playwright: the login field label is "Email or phone"; `getByLabel("Email")` still matches it.

## Added by ticket 05 (student registration)

- Students live in `src/core/students/`: `registerStudent(ctx, {...})` → `{ studentId, studentNumber, initialPassword }` (Admin-only, sets must-change), `resetStudentPassword(ctx, { studentId })` → `{ newPassword }` (Admin-only; ends sessions, must change again), `listStudents(ctx)`, `getStudentProfile`/`getStudentPhoto(ctx, { studentId })`. Disable/enable reuses `disableLogin`/`enableLogin`.
- A Student is a `user` (role "student", `user.email` null) plus a `student` row keyed by `userId`; **the Student's id is their `user.id`**, so `app.as({ role: "student", userId: studentId })` works in tests. The Student's optional email is `student.email`, not unique (siblings share a guardian's), and not a login. The emailed forgot-password flow therefore doesn't reach Students; the Admin resets them.
- Student Numbers are stored trimmed and upper-cased (`normaliseStudentNumber`), unique, and may not contain "@". `StudentNumberTaken` is the refusal.
- Login: a non-email identifier is tried as a Student Number first, then as a phone. Failed logins for it count under both `phone:<n>` and `student:<n>` keys (`rateLimitKeys`), and the lock uses the busiest key.
- Access: `requireCanSeeStudent(actor, studentId)` in `access.ts` (Admin: any; Student: only self; Teacher: refused until the roster rule is added there).
- Photos: JPEG/PNG/WebP up to 2 MB (`students/photo.ts`), stored as `bytea` in `student_photo` (kept apart so lists never load bytes), served by `src/app/students/[id]/photo/route.ts` through the layer. `next.config.ts` raises the server-action body limit to 3 MB for the upload. Use `customType` for bytea.
- UI: `/admin/students` (list + register form), `/admin/students/[id]` (profile, reset, disable), `/student` (a Student's own profile and landing page until the dashboard ticket). `StudentProfileCard` (`src/app/student-profile-card.tsx`) is shared.
- Playwright: the login field label is now "Email, phone or Student Number", and the failure text is "Login or password is incorrect.". Wait for the post-login page (click a link) before `page.goto`, or the navigation races the login redirect.

## Added by ticket 04 (classes and access)

- Tables `class` (Drizzle export `schoolClass`, since `class` is a keyword; unique `(academic_year_id, name)`) and `class_subject` (unique `(class_id, subject_id)`, indexed on `teacher_id`). Migration `0004_classes` (renumbered on top of ticket 05's `0003_students` at merge).
- Layer in `src/core/classes/`:
  - `classes.ts`: `createClass(ctx, { academicYearId, gradeId, name, classTeacherId })` (Admin), `listClasses` (Admin), `listMyClasses` (Teacher: the Classes they're Class Teacher of), `getClass(ctx, { classId })`, and `requireTeacher(ctx, userId)`, which throws `InvalidInput("errors.notATeacher")`.
  - `class-subjects.ts`: `createClassSubject(ctx, { classId, subjectId, teacherId })` (Admin, throws `ClassSubjectExists`), `reassignSubjectTeacher(ctx, { classSubjectId, teacherId })` (Admin), `listClassSubjects(ctx, { classId })` (the whole Class), `listMyClassSubjects(ctx)` (Teacher: only the ones they teach), `getClassSubject(ctx, { classSubjectId })`. Rows are a `ClassSubjectRow` with class, grade, year, subject and teacher names.
  - Test fixture: `src/core/classes/test-school.ts` `school()` builds a year, Grade 7, Math and Science, and the Teachers Huda, Omar and Sara through layer commands. Reuse it.
- **Access policy** (`src/core/access.ts`) now has async, DB-backed guards that take `ctx`:
  - `requireCanSeeClass(ctx, classId)`: the Admin or the Class's Class Teacher. It means the whole Class (every Class Subject), and a Subject Teacher alone does NOT pass.
  - `requireCanSeeClassSubject(ctx, classSubjectId)`: the Admin, its Subject Teacher, or its Class's Class Teacher.
  - Both throw `NotFound` for a missing or non-integer id (ids come from URLs), and `AccessDenied` otherwise. Students are refused for now.
  - Still to add when needed: "act on a Class Subject" (Subject Teacher only, for Lessons/Marks), "see a Class roster" (spec: Subject Teachers also see their Classes' rosters), and Student/Parent rules. Add them as new guards in `access.ts` next to these.
- UI: `/admin/classes` (list + `AddClassForm`), `/admin/classes/[id]` (Class Subjects with `ReassignTeacherForm`, plus `AddClassSubjectForm`), and `/teacher` (My Class Subjects + My Classes), `/teacher/classes/[id]`, `/teacher/class-subjects/[id]`. Admin forms live in `src/app/admin/classes/forms.tsx` (a controlled `Select` helper and `useOnSaved`). Disabled Teachers are left out of the Teacher selects, except a disabled current Subject Teacher.
- `/teacher` now goes through layer queries that require the Teacher role, so an Admin visiting it sees the access-denied text.
- Playwright: a `<label>` that wraps a `<select>` has the option texts in its label text, so `getByLabel(x, { exact: true })` misses it. Use `getByRole("combobox", { name: x, exact: true })`.
- Gotcha: `expect(...).rejects.toThrow(SomeError)` passes for ANY error if `SomeError` is an undefined import. Add the error class before you rely on a red test.
- Docker Desktop was not running at the start of this ticket, and testcontainers then fails with the opaque `code.charCodeAt is not a function` startup error. Check `docker info` first.

## Added by ticket 07 (lessons)

- Table `lesson` (unique `(class_subject_id, date, period)`), migration `0005_lessons`. It stores `teacher_id` = the Subject Teacher who logged it, so the summary still names who taught after a reassignment. Don't derive "who taught" from `class_subject.teacher_id`.
- Layer in `src/core/lessons/lessons.ts`: `logLesson(ctx, { classSubjectId, date, period, topic, homework? })` (refusals: `LessonExists`; `InvalidInput` keys `errors.lessonTopicRequired`, `lessonPeriodOutOfRange` (1..N, so refused while N is unset), `lessonDateInvalid` (not a real date, or after `clock.today()`), `lessonDateOutsideYear` (outside the Class's Academic Year)). `listClassLessons(ctx, { classId })` = the class summary (Admin or Class Teacher, via `requireCanSeeClass`), `listClassSubjectLessons(ctx, { classSubjectId })` (`requireCanSeeClassSubject`), `lessonFormDefaults(ctx, { classSubjectId })` → `{ today, periodsPerDay }` (Subject Teacher only). Rows sort newest day first, then Period, then Subject.
- **Access**: new guard `requireCanActOnClassSubject(ctx, classSubjectId)` in `access.ts`: only the current Subject Teacher; the Admin and the Class Teacher are refused (`AccessDenied`), and a missing id is `NotFound`. Reuse it for Marks/Assessments writes.
- **UI pattern for "show the form only to whoever may act"**: call a layer query guarded by the act-guard (like `lessonFormDefaults`) and map `AccessDenied` to `null` in the page. The page decides nothing itself.
- UI: the Lesson form is on `/teacher/class-subjects/[id]` (`lesson-form.tsx`, `actions.ts`), with Periods as radio tap targets (`.periods`/`.period-choice`, label "Period N"). The class summary is at `/admin/classes/[id]/lessons` and `/teacher/classes/[id]/lessons`, both thin wrappers around `src/app/class-lessons-page.tsx`, and `src/app/lesson-list.tsx` groups rows by day (each day is a `region` named by its date). New CSS helpers: `.success`, `.button-block`, `.field textarea`.
- Test fixture: `lessonsSchool()` in `lessons.test.ts` extends `school()` with 7-A/7-B, 6 Periods and today = 2026-10-15.
- **e2e**: the dev server uses the real clock, so date-checked records in e2e go in a **past** Academic Year (lessons.spec uses 2001-2002), never one around "today" (school-setup.spec owns 2026-2027 and years can't overlap). The Playwright project is Pixel 7, so every spec runs at phone width; `expectNoSidewaysScroll` in lessons.spec checks that the layout fits.
- **e2e gotcha**: Grade/Subject lists are sorted and shared across specs, so never assert by `nth(i)`. Find the row by value: `page.locator('input[name="name"][value="Grade 4"]')` (classes.spec was fixed this way).

## Added by ticket 06 (enrollment)

- Table `enrollment` (student_id, class_id, start_date, end_date nullable; inclusive range, null end = open). A partial unique index `enrollment_one_open_per_student` (`where end_date is null`) enforces at most one open Enrollment; the layer maps the violation to `AlreadyEnrolled`. Migration `0006_enrollment` (regenerated on top of ticket 07's `0005_lessons` at merge).
- Layer in `src/core/enrollment/`:
  - `enrollment.ts`: `enrollStudent(ctx, { studentId, classId, startDate })` (Admin; date must be inside the Class's Academic Year, else `InvalidInput("errors.enrollmentDateOutsideYear")`; `AlreadyEnrolled`; `NotFound` for unknown Student/Class). `moveStudent(ctx, { studentId, classId, date })` (Admin; ends the open Enrollment on `date - 1` and opens the next on `date`; `NotEnrolled`; `InvalidInput` keys `moveToSameClass`, `moveNeedsSameGrade` (same Grade AND Academic Year), `moveDateInvalid` (must be after the open one's start and within the year)). `classRoster(ctx, { classId, date? })` (default today). `enrollmentHistory(db, studentId)` (no guard, for callers that already checked).
  - `my-students.ts`: `listMyStudents(ctx, { classId?, classSubjectId? })` (Teacher only): Students enrolled **today** in the Teacher's Classes, each with the Class Subjects the Teacher teaches there. Filters narrow; a Class Subject the Teacher can't see gives an empty list, not a refusal.
  - **To ask "who is in Class X on date D", use the roster condition** `start_date <= D and (end_date is null or end_date >= D)`. Marks grids (spec: Students enrolled on the Assessment's date) and the Issuing Class (enrolled on the Term's last day) should reuse `classRoster`'s query rather than re-deriving it.
  - Test fixture: `src/core/enrollment/test-enrollment.ts` `enrollmentSchool(opts?)` = `school()` plus 7-A (Class Teacher Huda; Math: Sara) and 7-B (Class Teacher Omar; Math: Sara, Science: Huda), and the unenrolled Students Aisha and Bilal. `school(opts)` and `enrollmentSchool(opts)` now take `{ now }`.
- **Access** (`access.ts`):
  - `isTeacherOfClass(teacherId)`: a SQL condition over `schoolClass` (Class Teacher OR Subject Teacher of one of its Class Subjects). It defines "a Class's Teachers"; reuse it.
  - `requireCanSeeClassRoster(ctx, classId)`: the Admin and the Class's Teachers.
  - `requireCanSeeStudent(ctx, studentId)` is now **async and takes ctx** (it was `(actor, id)`): the Admin, the Student themselves, and the Student's Teachers = the Teachers of a Class the Student is enrolled in **today** (by the Clock). Teachers of a past Enrollment lose access.
- `StudentProfile` now has `enrollments: EnrollmentRow[]` (oldest first; `class`, `grade`, `academicYear`, dates). `StudentProfileCard` renders it as a list named "Enrollment history".
- UI: the Admin enrolls or moves from `/admin/students/[id]` (`enrollment-form.tsx`, action `saveEnrollment` with a hidden `mode`); move choices are limited to the same Grade and year. `ClassRoster` (`src/app/class-roster.tsx`, a GET `?date=` form, region "Students") is on `/admin/classes/[id]` and `/teacher/classes/[id]`. Teachers: `/teacher/students` (My Students, GET filters `classId`/`classSubjectId`, linked from `/teacher` and each Class Subject page) and `/teacher/students/[id]` (profile). `Select` and `Refusal` in `admin/classes/forms.tsx` are now exported for reuse.
- e2e: `enrollment.spec.ts` uses the future year 2041-2042 and checks rosters by date. Anything that depends on "today" (My Students, a Teacher opening a profile) is tested at the layer only.

## Added by ticket 08 (assessments and marks)

- Tables `assessment` and `mark` (primary key `(assessment_id, student_id)`; a raw `score` or a `status` of absent/exempt, never both), migration `0007_assessments_and_marks`. The Term is never stored: it comes from the date.
- Layer in `src/core/assessments/`:
  - `assessments.ts`: `createAssessment`, `updateAssessment` (maximum and weight; `errors.assessmentMaxBelowMark`), `assessmentFormDefaults`, `listAssessments` (with `stats`), `getAssessment`, `selectAssessments`.
  - `marks.ts`: `marksGrid(ctx, { assessmentId })` → `{ assessment, rows, stats, canEnterMarks }`, `saveMarks(ctx, { assessmentId, marks })` (one transaction, locks the Assessment row; a null Mark clears it), `studentAssessmentHistory(ctx, { studentId })`.
  - `mark-values.ts`: pure rules. `MarkValue` = number | "absent" | "exempt" | null, `requireValidMark`, `percentOf` (Absent = 0, Exempt or null = null), `markStats`, `toValue`.
  - Test fixture: `test-assessments.ts` `assessmentSchool()` (today 2026-10-20, Term 1 and Term 2, Aisha and Bilal in 7-A) and `quiz(classSubjectId, over?)`.
- **Marks access comes from the Class Subject, not the Student's Class today.** Guards in `access.ts`: `requireCanSeeAssessment`, `requireCanActOnAssessment` (current Subject Teacher only), `requireCanSeeStudentMarks`, and the SQL condition `canSeeClassSubjectMarks(actor)`.
- **A Mark can outlive its roster place**: a backdated `moveStudent` leaves the Mark stored for a Student no longer on the Assessment's roster. Anything that counts Marks must join through the roster condition (see `markStudentOnRoster` in `assessments.ts`). The spec's Term Grade rule already says this ("enrolled on the Assessment's date").
- **Publish must add the freeze** (ticket 11): `saveMarks` and `updateAssessment` have no Published check yet.
- `isCalendarDate` moved to `src/core/dates.ts`. `rosterOn(db, classId, date)` in `enrollment.ts` is the unguarded roster query, usable inside a transaction (`Tx` is exported there).
- UI: `/teacher/assessments/[id]` (grid, statistics, maximum and weight), the Assessment list and create form on `/teacher/class-subjects/[id]`, `/teacher/students/[id]/marks`, and `AssessmentHistory` (`src/app/assessment-history.tsx`) on `/student` and `/admin/students/[id]`. `markText`/`statsText` are in `src/app/mark-text.ts`.
- **e2e data must be unique across specs**, including login emails: specs share one database and run in parallel, so a repeated email times out whichever spec runs second. Each spec also needs its own Academic Year.

## Added by ticket 09 (Grading Scales and Term Grades)

- Tables `grading_scale` (one per Grade: `pass_mark`) and `grading_band` (primary key `(grade_id, min_percent)`, `label`), migration `0009_grading_scales` (regenerated on top of ticket 13's `0008_exams` at merge). A band is its lowest percentage and runs up to the next band's start, so gaps and overlaps can't be expressed. The lowest band must start at 0.
- Layer in `src/core/grading/`:
  - `grading-scales.ts`: `setGradingScale(ctx, { gradeId, passMark, bands })` (Admin; replaces the old one; `InvalidInput` keys `errors.grading*`), `getGradingScale(ctx, { gradeId })` (staff; null if none), `listGradingScales(ctx)` (Admin; every Grade, `scale` null if none), `scalesFor(db, gradeIds)` (unguarded). Bands read back highest first.
  - `term-grades.ts`: `studentTermGrades(ctx, { studentId })` → `{ term, issuingClass, grades }[]`, newest Term first. `classSubjectTermGrades(ctx, { classSubjectId, termId? })` → `{ subject, class, terms, term, rows }`: every Student in the Class at any time in the Term (opens on today's Term, else the year's first). `issuingClasses(db, studentIds, lastDay)` → `Map<studentId, IssuingClass>` (unguarded). **Ticket 10: use this for the Issuing Class, don't re-derive it.**
  - `term-grade-rules.ts`: pure `termGradeFigures` and `readOnScale`.
- A `TermGrade` is `{ subjectId, subject, percent, label, passed, counted, exempt, missing }`. Worked out when read, never stored.
- **Decisions the ticket left open:**
  - An Assessment with no Mark yet is left out of the figure and counted in `missing`, not treated as 0. **Ticket 10's preview should flag from `missing`.**
  - `percent` is rounded to two decimals, and the label and pass or fail read the rounded figure, so 79.9997% shows as 80% and earns the 80% band.
  - No counted Assessment means `percent`, `label` and `passed` are null. So do a Grade with no Grading Scale and a Student with no Class on the Term's last day (`label` and `passed` only; `percent` stays). **Ticket 10's overall percentage must skip a null `percent`, not average it as 0.**
  - A Subject with no Assessment on the Student's enrolled dates has no row in `studentTermGrades`.
- **Access**: `canSeeTermGrade` in `access.ts`, after `requireCanSeeStudentMarks`. The Admin and the Student see all. A Teacher sees a Subject's Term Grade if they can see the Marks of a Class Subject counted in it, or if they are the Issuing Class's Class Teacher (even for a Subject only the old Class had). The figure combines Classes, so 7-A's Subject Teacher sees the whole figure, including 7-B's Marks in it, though not those Marks themselves.
- **Tested in ticket 16** (`year-end.test.ts`, "Term Grades after year end"): a Grading Scale from a different Grade than the Student's earlier Class, and a Student with no Class on the Term's last day. See ticket 16's notes for how each state arises.
- **Publish (ticket 11)**: a Grading Scale has no freeze, and `setGradingScale` changes labels straight away. Whether a Published Report Card keeps its old labels is ticket 11's call.
- UI: `/admin/grading-scales` (one `GradingScaleForm` per Grade, linked from the Admin dashboard's setup list), `/teacher/class-subjects/[id]/term-grades` (GET `termId`), and `TermGrades` (`src/app/term-grades.tsx`) on `/student`, `/admin/students/[id]` and `/teacher/students/[id]/marks`. `termGradeText`/`termGradeNotes` are in `src/app/term-grade-text.ts`.
- e2e: `grading.spec.ts` owns year 2081-2082, Grade 3 and Biology. `exams.spec.ts` owns 2061-2062 and Grade 12. Grep `e2e/` before picking a year or Grade, since a parallel ticket may have taken it.
- Playwright: `page.url()` right after clicking a link races the navigation. `await expect(page).toHaveURL(...)` first.

## Added by ticket 13 (exam timetable)

- Table `exam` (`assessment_id` unique, `room_id`, `start_time`, `duration_minutes`), migration `exams`. **The Class Subject and date live only on the Exam's Assessment**: join through it, and anything that reschedules an Exam changes `assessment.date`. The Term is never stored. `start_time` is the school's wall-clock time (a Postgres `time`), and a sitting never runs past midnight, so clashes only compare Exams on one date.
- Layer in `src/core/exams/exams.ts`:
  - `addExam(ctx, { classSubjectId, roomId, type, date, startTime: "HH:MM", durationMinutes, maxMarks, weight })` → `{ id, assessmentId }` (Admin only). Refusals: `ExamClashForClass`, `ExamClashForRoom` (the Class is checked first), `NotFound`, `InvalidInput` keys `examStartTimeInvalid`, `examDurationInvalid`, plus the Assessment's own date, maximum and weight keys. Every Assessment type is accepted, and the Admin supplies type, maximum and weight, because an Assessment needs them. The Subject Teacher can still change the maximum and weight in the grid.
  - `examTimetable(ctx, { termId? })` → `{ term, groups } | null` (Admin only). With no `termId`: the Term today falls in, else the newest year's first Term; null if no Term exists. An `ExamGroup` is `{ date, startTime, endTime, durationMinutes, grade, subject, type, exams: [{ id, assessmentId, class, room, teacher }] }`, in time order. **A group is one Grade + Subject + type + date + start + duration**: Exams in different Grades or with different durations stay apart, and a single Exam is a group of one.
- **Ticket 14 (schedule views)**: `examTimetable` is Admin-only. Add new queries for Students and Teachers with their own guards rather than loosening it. Reuse the row select and the `startMinute`/`clockTime` helpers (they are private to `exams.ts`; export what you need).
- **Closed years**: `addExam` is covered through `insertAssessment`, which calls the guard (ticket 16).
- **Not built, because the ticket doesn't ask for it**: editing, moving or deleting an Exam, and one-step adding of a grade-wide Exam (story 56). A grade-wide Exam is added one Class at a time; the form keeps the date, time and marks after a save to make that quick. Anything that moves an Exam must re-run the clash check under the lock.
- **Clash checks are serialised** by a transaction-scoped advisory lock (`EXAM_TIMETABLE_LOCK`), so any new write that can create a clash must take it too. A two-promise `Promise.all` test does NOT prove a lock works here: the second transaction waits for a new pool connection and never interleaves. Open the pool's connections first and race several (see the "same moment" test, which was confirmed to fail without the lock).
- `insertAssessment(tx, input)` in `assessments.ts` is the validate-and-insert behind `createAssessment`, with no access check. Since ticket 16 it takes only a transaction, for the Closed-year guard. `requireId` is now exported from `access.ts`. `listYearClassSubjects(ctx, { academicYearId })` is an Admin query in `class-subjects.ts`. `useOnSaved` is exported from `admin/classes/forms.tsx`.
- UI: `/admin/exams` (linked from the Admin dashboard): a GET `?term=<id>` Term picker, the timetable and `AddExamForm`. The form's date input is limited to the Term on screen; the layer itself doesn't take a Term, since the date decides it.
- **e2e hydration race**: a controlled `<select>` chosen before React hydrates is reset by hydration, and `required` then silently blocks the submit. A cold `next dev` under 8 workers makes this likely. Call `await page.waitForLoadState("networkidle")` after navigating and before touching a form (see `open`/`settled` in `exams.spec.ts`). Older specs still have this exposure, apart from `enrollment.spec.ts`, which was fixed here. Subject names in use across specs include Physics and Chemistry, so check with grep before picking one.

## Added by ticket 16 (year end)

- **Every later write dated in an Academic Year MUST call the Closed-year guard. This includes tickets 10 and 11: remarks, Publish, unpublish and any Mark freeze path.** (Ticket 09 landed with no dated write: a Grading Scale belongs to a Grade.) `requireOpenYear(tx, record)` in `src/core/school/closed-year.ts`, where `record` is one of `{ academicYearId }`, `{ termId }`, `{ classId }`, `{ classSubjectId }` or `{ assessmentId }`. It throws `AcademicYearClosed`, or `NotFound` for an unknown record.
  - **Call it inside the write's own transaction, before writing.** It takes `Tx`, so `ctx.db` doesn't typecheck, and a single-statement write needs wrapping in `ctx.db.transaction`. It holds a `FOR SHARE` lock on the year's row until the transaction ends, so Closing waits for the write. A check outside the transaction could pass just before Closing and write just after.
  - Add a test to the "a Closed Academic Year refuses every write dated in it" block in `year-end.test.ts` (its `closedSchool()` builds a Closed year) for each new write.
  - `isYearClosed(db, record)` has no lock: it only decides what to offer on screen.
- **Writes already guarded**: `logLesson`, `createAssessment`, `updateAssessment`, `saveMarks`, `addExam` (via `insertAssessment`), `enrollStudent`, `moveStudent`, `createClass`, `createClassSubject`, `reassignSubjectTeacher`, `updateAcademicYear`, `promoteClass` (both years). Not dated, so not guarded: Grades, Subjects, Rooms, Periods, Grading Scales (`setGradingScale` changes labels shown for Closed years too), accounts, Student registration. The guard in `moveStudent` has no test of its own: a Closed year has no open Enrollment to move, so only a race with Closing can reach it.
- Column `academic_year.closed_at`, migration `year_end`. There is no reopen.
- Layer in `src/core/year-end/year-end.ts`:
  - `promoteClass(ctx, { classId, toClassId?, repeating?: [{ studentId, classId }], leaving?: [{ studentId, lastDay? }] })` (Admin; one transaction). It deals with every Student with an open Enrollment in the Class: their Enrollment ends on the year's last day and a new one starts on the new year's first day. The next year is the one starting soonest after this one ends. `InvalidInput` keys are `errors.promotion*`.
  - `closeAcademicYear(ctx, { academicYearId })` (Admin). `PromotionNotDone` while any Enrollment in the year is open, which is what "after Promotion" means. A year with no Enrollments can be Closed, and a year can be Closed before its last day: the ticket sets no such limit.
  - `yearEndOverview(ctx)` and `promotionForm(ctx, { classId })` are the Admin's queries behind the pages. Fixture: `test-year-end.ts` `yearEndSchool()`.
- **Decisions the ticket left open:**
  - **A Leaving Student may have an earlier `lastDay`** (default: the year's last day), for a Student who actually left during the year. The Enrollment ends that day, so rosters are right.
  - **Grades have no order, so the layer can't check "next Grade".** It refuses a target in the same Grade and otherwise trusts the Admin, so 7 to 9 would be accepted. Fixing this needs an order on `grade`.
- **Term Grades after year end (ticket 09's two states):**
  - Promotion alone never puts two Grades in one Term: the old Enrollment runs to the old year's last day, the new one starts in the new year, and a Term belongs to one year. Each Term stays on its own Grade's Scale. Two Grades in one Term only arises when a Leaving Student with an early `lastDay` is then enrolled in another Grade's Class in the same year.
  - A Student has no Class on a Term's last day only with an early `lastDay` (or a gap between Enrollments). **Ticket 10: such a Student has no Issuing Class, so no one owns their Report Card for that Term. Decide what the preview and Publish do with them.** Ticket 09 already gives a null label and pass or fail.
- **Known gap**: `updateAcademicYear` on an open year doesn't adjust Enrollments, so moving a year's last day after Promotion leaves its ended Enrollments on the old date.
- New rows fields: `yearClosed` on `ClassRow`, `ClassSubjectRow` and `AssessmentRow`, `closed` on `AcademicYear`. `marksGrid.canEnterMarks` is false for a Closed year, and `lessonFormDefaults`/`assessmentFormDefaults` throw `AcademicYearClosed`, which the Class Subject page maps to no form. **A new form-defaults query should do the same**, and a new form should hide on `yearClosed`.
- UI: `/admin/year-end` (linked from the Admin dashboard; every year, Classes waiting, the Close form with a required checkbox) and `/admin/year-end/classes/[id]` (`PromotionForm`). Closed years show `yearEnd.closedNotice` and offer no forms on the Admin Class, Academic Year and exam pages and the Teacher Class Subject and Assessment pages.
- e2e: `year-end.spec.ts` owns years 2095-2096 and 2096-2097, Grades 21 and 22. It relies on no other spec's year starting between those two, because Promotion targets the next year by date.

## Added by ticket 10 (Report Cards)

- Tables `subject_remark` (primary key `(class_subject_id, student_id, term_last_day)`) and `overall_remark` (`(class_id, student_id, term_last_day)`), column `school_settings.rank_enabled` (default false), migration `0011_report_cards`.
- Layer in `src/core/report-cards/`:
  - `report-cards.ts`: `classReportCards(ctx, { classId, termId? })` → `{ class, terms, term, rankEnabled, cards, noReportCard }` (Admin only). `reportCardsIssuedBy(ctx, classId, term)` and `draftReportCards(ctx, studentIds, term)` are the unguarded builders: **tickets 11 and 12 should build on these, so the PDF and the preview can't disagree.** Rank and flags are added only in `classReportCards`, using `ranksOf` and `flagsOf`. Rank must be worked out over the whole Issuing Class (`reportCardsIssuedBy`), never one Student.
  - `remarks.ts`: `saveSubjectRemark(ctx, { classSubjectId, termId, studentId, remark })`, `saveOverallRemark(ctx, { classId, termId, studentId, remark })`, `subjectRemarkSheet(ctx, { classSubjectId, termId? })`, `overallRemarkSheet(ctx, { classId, termId? })`. Sheets carry `yearClosed`. A blank remark clears it. Over 1000 characters is `errors.remarkTooLong`.
  - `rank-setting.ts`: `setRankEnabled(ctx, boolean)`, `getRankEnabled(ctx)` (Admin), `rankIsEnabled(db)` (unguarded).
  - `report-card-rules.ts`: pure `overallPercentOf`, `ranksOf`, `flagsOf`. `ReportCardFlag` kinds are `missingMarks`, `noAssessments`, `missingRemark`, `missingOverallRemark`.
  - `term-grades.ts` now exports `yearTerms`, `chooseTerm`, `studentsInClassDuring`, `termGradesIn` (not filtered by `canSeeTermGrade`) and `emptyTermGrade`.
- **Access**: `requireCanActOnClass` (the Class Teacher only, not the Admin) and `requireRemarkWriter(actor, writerId)` in `access.ts`. The Admin can't write remarks.
- **Decisions the ticket left open:**
  - **Remarks are keyed by the Term's last day, not its id**, because `updateAcademicYear` replaces Terms. Renaming Terms or re-saving the same dates keeps remarks. **Moving a Term's last day leaves that Term's remarks out** (the preview flags them as missing, and restoring the date brings them back) rather than filing them under another Term. Nothing deletes them.
  - **A Subject remark falls to the Subject Teacher in the Issuing Class.** A Subject the Issuing Class doesn't have falls to the Class Subject of its latest Assessment, so every flagged remark has someone who can write it.
  - **A remark names its Class or Class Subject, and a card reads only the one it currently draws on.** After a backdated move, the old Class's remarks don't show on the new card and are flagged as missing. Moving back brings them back.
  - **That writer sees the whole Term Grade on their sheet**, even before any of their own Assessments count in it. `studentTermGrades` isn't widened, so `/teacher/students/[id]/marks` can still hide that figure from them.
  - **No Issuing Class means no Report Card**: no Class Teacher owns it and no Class ranks them, so nobody can write its remarks. These Students appear in `noReportCard` with their `lastDay`, on the preview of the last Class they were in during the Term, and don't count as incomplete. Their Term Grades stay on their profile. **Ticket 11: Publish shouldn't wait for them, and they get nothing to Publish for that Term.**
  - **The overall percentage averages the two-decimal Term Grades shown**, in whole hundredths, and skips a null `percent`. Rank compares that rounded figure, so Students showing the same percentage tie. Ties skip ahead (1, 1, 3). No overall percentage means no rank and no place taken.
  - **A Subject of the Issuing Class with no Assessment in the Term** still gets a row (`percent` null), flagged `noAssessments` and `missingRemark`. An all-Exempt Term Grade isn't flagged for Marks but still wants a remark.
- **Publish (ticket 11)**: remark writes have no Published check yet. Add it in the same transactions as `requireOpenYear`, or a Published Report Card can change. Student access to Report Cards isn't built either: `classReportCards` is Admin-only and the sheets are Teacher-only.
- **Dashboard (ticket 15)**: "waiting to be Published" isn't built. `cards[i].flags` gives incompleteness per card.
- UI: `/admin/report-cards` (rank switch and Class list, linked from the dashboard), `/admin/classes/[id]/report-cards` (preview, GET `termId`, also linked from the Class page), `/teacher/class-subjects/[id]/remarks` (link shown to the Subject Teacher in an open year only), `/teacher/classes/[id]/remarks`. Closed years show remarks read-only. `TermPicker`/`termIdFrom` are in `src/app/term-picker.tsx`, `RemarkForm` in `src/app/teacher/remark-form.tsx` (key it by Term so text doesn't carry across Terms), and `.remark` and `.flags` in `globals.css`.
- e2e: `report-cards.spec.ts` owns year 2071-2072, Grade 5, Literature, and the school-wide rank switch: **another spec that reads rank must not assume it's off.**

## Added by ticket 14 (exam schedule views)

- Layer in `src/core/exams/exam-schedule.ts`: `myExamSchedule(ctx)` → `{ name, exams: ScheduledExam[] }` in time order, and `myExamCalendar(ctx)` → the .ics text. Both take the viewer from the actor, with no id input, and refuse the Admin (`AccessDenied`; the Admin has `examTimetable`). **Ticket for the Student dashboard (story 64)**: find the next Exam from `myExamSchedule` by comparing `date`/`startTime` with the Clock.
- **Whose Exams**: a Student's are every Exam of the Class they're enrolled in **today**, past dates included. Moving Class drops the old Class's Exams on the move date, and a Student with no Enrollment covering today has none. A Teacher's are the Class Subjects where they're the **current Subject Teacher**. Being only the Class Teacher doesn't add a Class's Exams, and a reassignment moves the Exams to the new Teacher. A Teacher's schedule spans all Academic Years, since the ticket doesn't limit it, so a past year's Exams stay listed first.
- `examRows(db, where)` in `exams.ts` is the shared row query behind the timetable and the schedules. `startMinute` and `clockTime` are exported.
- **The Clock has a new method**: `clock.at(date, minutes)` → the `Date` of a wall-clock time at the school, using the Clock's time zone (`SCHOOL_TIME_ZONE`, default Asia/Dubai) and handling daylight saving. Use it whenever an Exam's wall-clock time must become an instant. Any new Clock implementation needs it.
- **.ics**: `src/core/exams/ics.ts` `icsCalendar(now, events)` handles CRLF, text escaping and 75-octet folding. Times are written in UTC, not floating, so a calendar set to another time zone still shows the right moment. UIDs are `exam-<id>@school-lms`, stable so re-importing updates rather than duplicates. A schedule with no Exams gives a calendar with no events, which RFC 5545 doesn't strictly allow, so the page hides the link then.
- **Layer text**: `exam-schedule.ts` imports `t` from `@/i18n` for the event's summary, because a file has no UI layer to translate it. `@/i18n` has no Next dependency, so this keeps `src/core` framework-independent.
- UI: `/student/exams` and `/teacher/exams` are thin wrappers around `src/app/exam-schedule-page.tsx`, linked as "My Exams" from each landing page. `/exams/schedule.ics` (route handler) is one URL for both roles. It uses a plain `<a download>`, because `next/link` would try to route to a file.
- **Printing**: the schedule page is its own printable view. `@media print` in `globals.css` removes `.no-print` elements and the card chrome. Add `.no-print` to anything that shouldn't reach paper. `PrintButton` (`src/app/print-button.tsx`) currently says "Print" through `examSchedule.print`; move the key if another page reuses it.
- **e2e, testing "current" things through the real UI**: an **open Enrollment that began in a past year still covers today**, so a spec can have a Student with a current Class without depending on the date (`exam-schedule.spec.ts` uses 2005-2006). Teachers' schedules don't depend on today at all. To test print styles use `page.emulateMedia({ media: "print" })`, and set a `window.print` stub only after `networkidle`.
- **e2e under load**: when other suites run on the same machine (load average above 100 was seen), specs can fail at the very first `toHaveURL(/\/admin$/)` after login, because `expect` waits 5 s while `next dev` compiles cold. Check `error-context.md`: no refusal text on the login page means a timeout, not a bug. Re-run before changing code.

## Added by ticket 11 (Publish)

- Tables `report_card_publication` (one row per Publish, kept after unpublishing; a partial unique index allows one standing per Class and Term) and `published_report_card` (`(publication_id, student_id)`, the card as `jsonb`). Migration `0012_publish`. A Publication names its Term by dates and stores its names, never a Term id.
- Layer in `src/core/report-cards/`:
  - `publish.ts`: `publishReportCards(ctx, { classId, termId })` (Admin; `AlreadyPublished`, `InvalidInput("errors.publishNoReportCards")`), `unpublishReportCards(ctx, { classId, termId })` (Admin; `NotPublished`), `studentReportCards(ctx, { studentId })` → `StudentReportCard[]`, newest Term first (the Admin and that Student only; `requireCanSeeReportCards`).
  - `publications.ts`: the freeze guards and `publicationRecords`. It imports nothing from `report-cards.ts` at runtime, so `enrollment.ts` and `academic-year.ts` can use it without a cycle.
  - `classReportCards` now also returns `yearClosed`, `publication` (the standing one or null) and `publicationHistory` (who and when, newest first). **While Published, its `cards` and `rankEnabled` come from the stored Publication.**
- **Decisions the ticket left open:**
  - **A Published Report Card is stored, not re-worked out.** This settles ticket 09's question: a new Grading Scale, the rank switch or a new Subject Teacher doesn't change a Published card. `studentTermGrades` stays live, so a Student's profile can show a new label beside the card's old one until the Admin Publishes again.
  - **What a standing Publication freezes** (all refuse with `ReportCardsPublished`, `errors.reportCardsPublished`):
    - A Mark on an Assessment dated in the Term, if the Assessment's Class is the one Published, or the Student has a stored card in the Publication of any Class. So Publishing 7-B freezes Aisha's Marks on 7-A's Assessments, and Publishing 7-A freezes hers on its roster even though her card is 7-B's.
    - An Assessment's maximum and weight, if the same applies to its Class or to any Student on its roster.
    - Both remarks on a Student's card, new, changed or cleared.
    - Enrollment changes that would change who is in the Class on the Term's last day: `enrollStudent`, `moveStudent` (both Classes), and `promoteClass` (an early Leaving `lastDay`, or a target Class Published). Later dates are fine.
    - `updateAcademicYear`, if it doesn't keep a Published Term's exact dates. Renaming is fine, though the card keeps the Term name it was Published with.
  - **Not frozen**: creating an Assessment in a Published Term (or adding an Exam), since it has no Marks and they'd be refused. A `saveMarks` with an empty list. A Student with no stored card in a Class that isn't Published, even with Marks in the Term.
  - **`saveMarks` refuses the whole save if any entry is frozen**, even an unchanged value, since nothing distinguishes it from a write. So a grid must leave frozen Students out: `GridRow.published`. The form renders those rows read-only with no fields.
  - **Publish doesn't require a complete card.** The preview says what's missing and the Admin decides. It does refuse a Class issuing no Report Card, and it isn't limited to after the Term's last day.
  - **Admin-only unpublish, one Admin**: `bootstrapAdmin` is idempotent, so tests can't seed a second Admin to tell them apart.
- **Any new write that a Published card depends on must call a guard from `publications.ts`, inside its transaction, after `requireOpenYear`.** Ticket 22 (leave): turning Absent into Exempt is a Mark write, so call `requireMarksNotFrozen`, and decide what happens for a frozen Mark rather than failing the approval.
- **The freeze lock** is advisory: guards take it shared, Publish and unpublish take it exclusively. Keep the order **year row, then freeze lock**. Don't take the freeze lock and then update the `academic_year` row (`saveAcademicYear` updates first for this reason). Inside Publish, read through the transaction, not `ctx.db`: writers waiting for the lock can hold every other connection in the pool.
- **Testing a lock**: `Promise.all` races passed with the lock removed. The "in flight" test in `publish.test.ts` holds a Mark's row, so the save parks past its checks, starts Publish, and watches `pg_stat_activity`. It fails with the lock removed. Copy that pattern.
- **Ticket 12 (PDF)**: render from `StudentReportCard` for a Student's card. It has `publicationId`, `term`, `rankShown`, `publishedAt` and every `PublishedCard` field, including `rank`. `ReportCardBody` (`src/app/report-card-body.tsx`) is the shared on-screen rendering. For the Admin's export of an unpublished Class, use `classReportCards`, which shows the live drafts until Publish. Decide whether a draft may be exported.
- **Ticket 15 (dashboard)**: "waiting to be Published" means a Term with cards and `publication` null from `classReportCards`. It builds every card, so add a cheaper count over `report_card_publication` instead of calling it per Class.
- UI: the "Publish" region on `/admin/classes/[id]/report-cards` (`publish-form.tsx`, `actions.ts`, with the record of who and when), `/student/report-cards` (linked as "My Report Cards" from `/student`), and `PublishedReportCards` (`src/app/published-report-cards.tsx`) also on `/admin/students/[id]`. `whenText` (`src/app/when-text.ts`, server only) shows an instant on the school's clock. A Published row on the Teacher's remark sheets and grid is read-only.
- e2e: `publish.spec.ts` owns year 2091-2092, Grade 23 and Oceanography.

## Added by ticket 12 (Report Card PDF)

- **Ticket 19 (Payment Record PDF): reuse `src/web/pdf.ts`.** `renderPdf(html)` → A4 PDF bytes, `pdfResponse(pdf, fileName)` (attachment, `private, no-store`; `fileName` must be plain ASCII with no quotes, or the header throws or breaks), `refusalResponse(err)` (`AccessDenied` 403, `NotFound` 404, rethrows the rest, including Next redirects). One browser is shared per server and each render gets its own context.
- **The document must be one self-contained HTML string.** `renderPdf` turns JavaScript off and aborts every request, so inline all CSS and images (a photo would need a `data:` URL). Text from the database must be escaped: copy `escaped` from `src/app/report-card-document.ts`, and move it somewhere shared when you do.
- **`react-dom/server` isn't available in route handlers**: they run in Next's server-component layer, where it resolves to a stub. That's why `report-card-document.ts` is a template string that mirrors `ReportCardBody` by hand with the same text helpers (`overallText`, `termGradeText`, `termGradeNotes`). **Anything added to what a Report Card says must be added to both.**
- Layer in `src/core/report-cards/export.ts`: `studentReportCardExport(ctx, { studentId, publicationId })` (the Admin and that Student; `NotFound` if unpublished or not theirs) and `classReportCardExport(ctx, { classId, termId?, studentId? })` (Admin only; `NotFound` if there's no such card). Both return `{ fileName, cards: PrintableReportCard[] }`, with the file name built in the layer so it can be tested. `PublicationRecord` now has `termName` and `academicYearName`.
- **Decisions the ticket left open:**
  - **The Admin may export a draft.** The ticket doesn't limit the Admin's export to Published cards, and proofing on paper is useful. `publishedAt` is null, every page carries "Draft: not Published", and the links say "draft". Students only ever get Published cards.
  - **A Published export uses the names it was Published with**, not `classReportCards.term`, which is live. Otherwise a renamed Term would make the Admin's copy differ from the Student's.
  - **A whole Class is one PDF**, one Student to a page, since story 53 is about printing them.
  - **A Teacher gets no PDF**, as `requireCanSeeReportCards` already says.
- Routes: `/students/[id]/report-cards/[publicationId]/pdf` and `/admin/classes/[id]/report-cards/pdf` (`?termId=`, `?studentId=`). Links are in `PublishedReportCards` (so on `/student/report-cards` and `/admin/students/[id]`) and on the Admin's preview.
- **Production runs Chromium.** `playwright` is now a runtime dependency, at the same exact version as `@playwright/test`: **upgrade them together.** The `Dockerfile` moved from Alpine to `node:24-bookworm-slim` because Chromium doesn't run on musl, and installs the headless shell into `/ms-playwright`. `compose.yaml` gives the app `shm_size: 256m` and `init: true`. Don't move the image back to Alpine or prune `node_modules` from it. `next.config.ts` needs nothing: Next already treats `playwright` as external.
- **Known gap**: Arabic in names and remarks comes out legible and in the right order, but in a crude fallback font, because the image has no proper Arabic font. Arabic is P2 in the spec. Installing a font in the `Dockerfile` (e.g. `fonts-noto-core`, which the document's font stack already names) should fix it. Check the image size if you do.
- Nothing refuses or queues PDF requests: a heavy rush of downloads is limited only by the server's memory.
- e2e: `report-card-pdf.spec.ts` owns year 2111-2112, Grade 31 and Cartography. `pdfjs-dist` (dev only) reads PDFs back as text, so a test can check pages and content rather than just the `%PDF-` header. To smoke the production image, run this spec with a config that has no `webServer` against `docker compose up --build`.

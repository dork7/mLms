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
- **Not yet tested**: a Grading Scale from a different Grade than the Student's earlier Class. `moveStudent` stays within a Grade and nothing else ends an Enrollment, so no layer command can produce it, nor a Student with no Class on the Term's last day. **Ticket 12 (Promotion, Leaving) makes both reachable: add those two tests there.**
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
- **Ticket 16 (year end)**: `addExam` has no Closed-year check yet. It writes through `insertAssessment`, so a check there covers both Exams and Assessments.
- **Not built, because the ticket doesn't ask for it**: editing, moving or deleting an Exam, and one-step adding of a grade-wide Exam (story 56). A grade-wide Exam is added one Class at a time; the form keeps the date, time and marks after a save to make that quick. Anything that moves an Exam must re-run the clash check under the lock.
- **Clash checks are serialised** by a transaction-scoped advisory lock (`EXAM_TIMETABLE_LOCK`), so any new write that can create a clash must take it too. A two-promise `Promise.all` test does NOT prove a lock works here: the second transaction waits for a new pool connection and never interleaves. Open the pool's connections first and race several (see the "same moment" test, which was confirmed to fail without the lock).
- `insertAssessment(db | tx, input)` in `assessments.ts` is the unguarded validate-and-insert behind `createAssessment`. `requireId` is now exported from `access.ts`. `listYearClassSubjects(ctx, { academicYearId })` is an Admin query in `class-subjects.ts`. `useOnSaved` is exported from `admin/classes/forms.tsx`.
- UI: `/admin/exams` (linked from the Admin dashboard): a GET `?term=<id>` Term picker, the timetable and `AddExamForm`. The form's date input is limited to the Term on screen; the layer itself doesn't take a Term, since the date decides it.
- **e2e hydration race**: a controlled `<select>` chosen before React hydrates is reset by hydration, and `required` then silently blocks the submit. A cold `next dev` under 8 workers makes this likely. Call `await page.waitForLoadState("networkidle")` after navigating and before touching a form (see `open`/`settled` in `exams.spec.ts`). Older specs still have this exposure, apart from `enrollment.spec.ts`, which was fixed here. Subject names in use across specs include Physics and Chemistry, so check with grep before picking one.

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

// The whole database schema. One deployment = one school (ADR 0001): no tenant key.
// After editing, run `npm run db:generate` to write a new migration into drizzle/.
import {
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  time,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const roleEnum = pgEnum("role", ["admin", "teacher", "student"]);

// ---- Identity (tables shaped like Better Auth's; src/core/accounts owns login and sessions) ----

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  // Staff log in with email or phone, so either may be missing. Stored normalised
  // (email lower-cased, phone digits with an optional leading +).
  email: text("email").unique(),
  phone: text("phone").unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: roleEnum("role").notNull(),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  /** Set when the Admin disables the login. The person and their records are kept. */
  disabledAt: timestamp("disabled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---- Login protection ----

/** Failed logins per identifier, for rate-limiting. Cleared by a successful login. */
export const failedLogin = pgTable(
  "failed_login",
  {
    id: serial("id").primaryKey(),
    identifier: text("identifier").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull(),
  },
  (t) => [index("failed_login_identifier_at_idx").on(t.identifier, t.at)],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---- School structure (ticket 03) ----
// Dates are calendar dates (YYYY-MM-DD strings) and ranges are inclusive at both ends.

export const academicYear = pgTable("academic_year", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
  /** When the year was Closed (ticket 16); null while it is open. */
  closedAt: timestamp("closed_at", { withTimezone: true }),
});

export const term = pgTable("term", {
  id: serial("id").primaryKey(),
  academicYearId: integer("academic_year_id")
    .notNull()
    .references(() => academicYear.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
});

export const grade = pgTable("grade", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

export const subject = pgTable("subject", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

export const room = pgTable("room", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

// One row (id = 1): school-wide settings set by the Admin.
export const schoolSettings = pgTable("school_settings", {
  id: integer("id").primaryKey().default(1),
  periodsPerDay: integer("periods_per_day"),
  /** Whether Report Cards show a rank within the Issuing Class. Off until the Admin turns it on. */
  rankEnabled: boolean("rank_enabled").notNull().default(false),
});

// ---- Classes (ticket 04) ----

/** One cohort of a Grade in one Academic Year, such as 7-A, with its one Class Teacher. */
export const schoolClass = pgTable(
  "class",
  {
    id: serial("id").primaryKey(),
    academicYearId: integer("academic_year_id")
      .notNull()
      .references(() => academicYear.id),
    gradeId: integer("grade_id")
      .notNull()
      .references(() => grade.id),
    name: text("name").notNull(),
    classTeacherId: text("class_teacher_id")
      .notNull()
      .references(() => user.id),
  },
  (t) => [unique("class_year_name_unique").on(t.academicYearId, t.name)],
);

/** A Subject as taught to one Class by one Subject Teacher, such as Math for 7-A. */
export const classSubject = pgTable(
  "class_subject",
  {
    id: serial("id").primaryKey(),
    classId: integer("class_id")
      .notNull()
      .references(() => schoolClass.id),
    subjectId: integer("subject_id")
      .notNull()
      .references(() => subject.id),
    teacherId: text("teacher_id")
      .notNull()
      .references(() => user.id),
  },
  (t) => [
    unique("class_subject_class_subject_unique").on(t.classId, t.subjectId),
    index("class_subject_teacher_idx").on(t.teacherId),
  ],
);

// ---- Students (ticket 05) ----
// A Student is a `user` with role "student" plus this record. They log in with their
// Student Number (stored trimmed and upper-cased), never with an email.

export const student = pgTable("student", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  studentNumber: text("student_number").notNull().unique(),
  dateOfBirth: date("date_of_birth", { mode: "string" }).notNull(),
  nationalId: text("national_id").notNull(),
  guardianContact: text("guardian_contact").notNull(),
  /** At most one email on record, possibly a guardian's shared by siblings, so not unique. */
  email: text("email"),
  admissionDate: date("admission_date", { mode: "string" }).notNull(),
});

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

/** The Student's photo, kept apart so listing Students never loads image bytes. */
export const studentPhoto = pgTable("student_photo", {
  studentId: text("student_id")
    .primaryKey()
    .references(() => student.userId, { onDelete: "cascade" }),
  contentType: text("content_type").notNull(),
  data: bytea("data").notNull(),
});

// ---- Enrollment (ticket 06) ----

/**
 * A Student's membership of a Class for a date range (inclusive; no end date = open).
 * A Student has at most one open Enrollment: enforced by the partial unique index.
 */
export const enrollment = pgTable(
  "enrollment",
  {
    id: serial("id").primaryKey(),
    studentId: text("student_id")
      .notNull()
      .references(() => student.userId),
    classId: integer("class_id")
      .notNull()
      .references(() => schoolClass.id),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }),
  },
  (t) => [
    uniqueIndex("enrollment_one_open_per_student")
      .on(t.studentId)
      .where(sql`${t.endDate} is null`),
    index("enrollment_class_idx").on(t.classId, t.startDate),
  ],
);

// ---- Lessons (ticket 07) ----

/**
 * One delivered teaching session of a Class Subject: at most one per Class Subject,
 * date and Period. `teacherId` is the Subject Teacher who logged it, kept so the
 * class summary still names who taught it after the Class Subject is reassigned.
 */
export const lesson = pgTable(
  "lesson",
  {
    id: serial("id").primaryKey(),
    classSubjectId: integer("class_subject_id")
      .notNull()
      .references(() => classSubject.id),
    date: date("date", { mode: "string" }).notNull(),
    period: integer("period").notNull(),
    topic: text("topic").notNull(),
    homework: text("homework").notNull().default(""),
    teacherId: text("teacher_id")
      .notNull()
      .references(() => user.id),
    loggedAt: timestamp("logged_at", { withTimezone: true }).notNull(),
  },
  (t) => [unique("lesson_class_subject_date_period_unique").on(t.classSubjectId, t.date, t.period)],
);

// ---- Assessments and Marks ----

export const assessmentTypeEnum = pgEnum("assessment_type", ["quiz", "assignment", "midterm", "final"]);

/**
 * Anything graded with Marks for one Class Subject. Its Term is worked out from its
 * date and never stored (Term ids change when a year's Terms are edited).
 */
export const assessment = pgTable(
  "assessment",
  {
    id: serial("id").primaryKey(),
    classSubjectId: integer("class_subject_id")
      .notNull()
      .references(() => classSubject.id),
    type: assessmentTypeEnum("type").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    maxMarks: numeric("max_marks", { precision: 7, scale: 2, mode: "number" }).notNull(),
    weight: numeric("weight", { precision: 7, scale: 2, mode: "number" }).notNull(),
  },
  (t) => [
    index("assessment_class_subject_idx").on(t.classSubjectId, t.date),
    check("assessment_max_marks_positive", sql`${t.maxMarks} > 0`),
    check("assessment_weight_positive", sql`${t.weight} > 0`),
  ],
);

/** Absent counts as zero; Exempt is left out. Extensible (approved leave turns Absent into Exempt). */
export const markStatusEnum = pgEnum("mark_status", ["absent", "exempt"]);

/** A Student's Mark on one Assessment: a raw score or a status, never both. */
export const mark = pgTable(
  "mark",
  {
    assessmentId: integer("assessment_id")
      .notNull()
      .references(() => assessment.id),
    studentId: text("student_id")
      .notNull()
      .references(() => student.userId),
    score: numeric("score", { precision: 7, scale: 2, mode: "number" }),
    status: markStatusEnum("status"),
  },
  (t) => [
    primaryKey({ columns: [t.assessmentId, t.studentId] }),
    index("mark_student_idx").on(t.studentId),
    check("mark_score_or_status", sql`(${t.score} is null) <> (${t.status} is null)`),
  ],
);

// ---- Grading ----

/** One per Grade: the pass mark. Its percentage bands are in `gradingBand`. */
export const gradingScale = pgTable(
  "grading_scale",
  {
    gradeId: integer("grade_id")
      .primaryKey()
      .references(() => grade.id),
    passMark: numeric("pass_mark", { precision: 5, scale: 2, mode: "number" }).notNull(),
  },
  (t) => [check("grading_scale_pass_mark_range", sql`${t.passMark} between 0 and 100`)],
);

/**
 * A band runs from `minPercent` up to the next band's start, so bands can't leave gaps
 * or overlap. The layer requires the lowest to start at 0.
 */
export const gradingBand = pgTable(
  "grading_band",
  {
    gradeId: integer("grade_id")
      .notNull()
      .references(() => gradingScale.gradeId, { onDelete: "cascade" }),
    minPercent: numeric("min_percent", { precision: 5, scale: 2, mode: "number" }).notNull(),
    label: text("label").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.gradeId, t.minPercent] }),
    check("grading_band_min_percent_range", sql`${t.minPercent} between 0 and 100`),
  ],
);

// ---- Exams (ticket 13) ----

/**
 * An Assessment that also has a scheduled sitting. Its Class Subject and date live on
 * its Assessment, so they can't drift apart. The start is the school's wall-clock time,
 * and a sitting never runs past midnight, so clashes only compare Exams on one date.
 */
export const exam = pgTable(
  "exam",
  {
    id: serial("id").primaryKey(),
    assessmentId: integer("assessment_id")
      .notNull()
      .unique()
      .references(() => assessment.id),
    roomId: integer("room_id")
      .notNull()
      .references(() => room.id),
    startTime: time("start_time", { precision: 0 }).notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
  },
  (t) => [
    index("exam_room_idx").on(t.roomId),
    check("exam_duration_positive", sql`${t.durationMinutes} > 0`),
  ],
);

// ---- Report Cards ----
// A remark belongs to a Term by the Term's last day, never its id: editing an Academic
// Year replaces its Terms and their ids. A remark also names the Class or Class Subject
// it was written for, and a Report Card reads only the one it currently draws on, so a
// backdated move can't leave another Class's remark on the card.

/** A Subject Teacher's remark on one Student's Term Grade. */
export const subjectRemark = pgTable(
  "subject_remark",
  {
    classSubjectId: integer("class_subject_id")
      .notNull()
      .references(() => classSubject.id),
    studentId: text("student_id")
      .notNull()
      .references(() => student.userId),
    termLastDay: date("term_last_day", { mode: "string" }).notNull(),
    remark: text("remark").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.classSubjectId, t.studentId, t.termLastDay] }),
    index("subject_remark_student_idx").on(t.studentId, t.termLastDay),
  ],
);

/** The Issuing Class's Class Teacher's overall remark on one Student's Report Card. */
export const overallRemark = pgTable(
  "overall_remark",
  {
    classId: integer("class_id")
      .notNull()
      .references(() => schoolClass.id),
    studentId: text("student_id")
      .notNull()
      .references(() => student.userId),
    termLastDay: date("term_last_day", { mode: "string" }).notNull(),
    remark: text("remark").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.classId, t.studentId, t.termLastDay] }),
    index("overall_remark_student_idx").on(t.studentId, t.termLastDay),
  ],
);

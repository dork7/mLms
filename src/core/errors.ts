// Errors the application layer throws for expected refusals. The web layer maps
// them to UI messages via their `messageKey` (a translation key).

export class AccessDenied extends Error {
  readonly messageKey = "errors.accessDenied";
  constructor(reason = "access denied") {
    super(reason);
    this.name = "AccessDenied";
  }
}

// ---- Accounts ----

/** Input the layer refuses, e.g. a missing name. The messageKey says why. */
export class InvalidInput extends Error {
  constructor(readonly messageKey: string) {
    super(messageKey);
    this.name = "InvalidInput";
  }
}

/** Another account already logs in with this email or phone. */
export class DuplicateLogin extends Error {
  readonly messageKey = "errors.duplicateLogin";
  constructor() {
    super("email or phone already in use");
    this.name = "DuplicateLogin";
  }
}

/** Wrong identifier or password, or a disabled login (deliberately indistinguishable). */
export class LoginFailed extends Error {
  readonly messageKey = "login.invalid";
  constructor() {
    super("login failed");
    this.name = "LoginFailed";
  }
}

/** Too many failed logins for this identifier; try again later. */
export class TooManyLoginAttempts extends Error {
  readonly messageKey = "login.tooManyAttempts";
  constructor() {
    super("too many failed logins");
    this.name = "TooManyLoginAttempts";
  }
}

/** The password reset link is unknown, used or expired. */
export class InvalidResetToken extends Error {
  readonly messageKey = "resetPassword.invalidToken";
  constructor() {
    super("invalid or expired reset token");
    this.name = "InvalidResetToken";
  }
}

/** Another Student already has this Student Number. */
export class StudentNumberTaken extends Error {
  readonly messageKey = "errors.studentNumberTaken";
  constructor() {
    super("Student Number already in use");
    this.name = "StudentNumberTaken";
  }
}

/** Postgres unique violation (23505), possibly wrapped by Drizzle in `cause`. */
export function isUniqueViolation(err: unknown): boolean {
  for (let e = err; e; e = (e as { cause?: unknown }).cause) {
    if ((e as { code?: string }).code === "23505") return true;
  }
  return false;
}

// ---- School setup ----

export class TermsDoNotCoverYear extends Error {
  readonly messageKey = "errors.termsDoNotCoverYear";
  constructor(reason = "Terms must cover the Academic Year with no gaps or overlaps") {
    super(reason);
    this.name = "TermsDoNotCoverYear";
  }
}

export class AcademicYearsOverlap extends Error {
  readonly messageKey = "errors.academicYearsOverlap";
  constructor(reason = "Academic Year overlaps an existing one") {
    super(reason);
    this.name = "AcademicYearsOverlap";
  }
}

export class NameTaken extends Error {
  readonly messageKey = "errors.nameTaken";
  constructor(reason = "that name is already used") {
    super(reason);
    this.name = "NameTaken";
  }
}

export class NotFound extends Error {
  readonly messageKey = "errors.notFound";
  constructor(reason = "not found") {
    super(reason);
    this.name = "NotFound";
  }
}

// ---- Classes ----

/** The Class already has a Class Subject for this Subject. */
export class ClassSubjectExists extends Error {
  readonly messageKey = "errors.classSubjectExists";
  constructor(reason = "this Class already has that Subject") {
    super(reason);
    this.name = "ClassSubjectExists";
  }
}

// ---- Enrollment ----

/** The Student already has an open Enrollment (move them instead). */
export class AlreadyEnrolled extends Error {
  readonly messageKey = "errors.alreadyEnrolled";
  constructor(reason = "the Student already has an open Enrollment") {
    super(reason);
    this.name = "AlreadyEnrolled";
  }
}

/** The Student has no open Enrollment to move or end. */
export class NotEnrolled extends Error {
  readonly messageKey = "errors.notEnrolled";
  constructor(reason = "the Student has no open Enrollment") {
    super(reason);
    this.name = "NotEnrolled";
  }
}

// ---- Lessons ----

/** A Lesson is already logged for this Class Subject, date and Period. */
export class LessonExists extends Error {
  readonly messageKey = "errors.lessonExists";
  constructor(reason = "a Lesson is already logged for that date and Period") {
    super(reason);
    this.name = "LessonExists";
  }
}

// ---- Exams ----

/** The Exam overlaps another Exam for the same Class. */
export class ExamClashForClass extends Error {
  readonly messageKey = "errors.examClashForClass";
  constructor(reason = "this Class already has an Exam at an overlapping time") {
    super(reason);
    this.name = "ExamClashForClass";
  }
}

/** The Exam overlaps another Exam in the same Room. */
export class ExamClashForRoom extends Error {
  readonly messageKey = "errors.examClashForRoom";
  constructor(reason = "this Room already has an Exam at an overlapping time") {
    super(reason);
    this.name = "ExamClashForRoom";
  }
}

// ---- Year end ----

/** The Academic Year is Closed, so its records are read-only. */
export class AcademicYearClosed extends Error {
  readonly messageKey = "errors.academicYearClosed";
  constructor(reason = "this Academic Year is Closed") {
    super(reason);
    this.name = "AcademicYearClosed";
  }
}

/** A Student in the year still has an open Enrollment, so it can't be Closed yet. */
export class PromotionNotDone extends Error {
  readonly messageKey = "errors.promotionNotDone";
  constructor(reason = "Students in this Academic Year are still waiting for Promotion") {
    super(reason);
    this.name = "PromotionNotDone";
  }
}

export class InvalidPeriodsPerDay extends Error {
  readonly messageKey = "errors.invalidPeriodsPerDay";
  constructor(reason = "Periods per day must be a whole number from 1 to 20") {
    super(reason);
    this.name = "InvalidPeriodsPerDay";
  }
}

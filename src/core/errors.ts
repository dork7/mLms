// Errors the application layer throws for expected refusals. The web layer maps
// them to UI messages via their `messageKey` (a translation key).

export class AccessDenied extends Error {
  readonly messageKey = "errors.accessDenied";
  constructor(reason = "access denied") {
    super(reason);
    this.name = "AccessDenied";
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

export class InvalidPeriodsPerDay extends Error {
  readonly messageKey = "errors.invalidPeriodsPerDay";
  constructor(reason = "Periods per day must be a whole number from 1 to 20") {
    super(reason);
    this.name = "InvalidPeriodsPerDay";
  }
}

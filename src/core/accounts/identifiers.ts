// How login identifiers are normalised before storing or matching. Staff log in with
// an email or phone; Students log in with their Student Number.

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Keeps digits and an optional leading +, so "+971 50-123 4567" matches "+971501234567". */
export function normalisePhone(phone: string): string {
  const trimmed = phone.trim();
  return (trimmed.startsWith("+") ? "+" : "") + trimmed.replace(/\D/g, "");
}

/** Student Numbers match case-insensitively: "s-1024" is "S-1024". */
export function normaliseStudentNumber(studentNumber: string): string {
  return studentNumber.trim().toUpperCase();
}

/**
 * A login identifier is an email if it contains "@". Otherwise it is a Student Number
 * or a phone number; login tries the Student Number first, then the phone.
 */
export function parseIdentifier(
  identifier: string,
): { email: string } | { studentNumber: string; phone: string } {
  return identifier.includes("@")
    ? { email: normaliseEmail(identifier) }
    : { studentNumber: normaliseStudentNumber(identifier), phone: normalisePhone(identifier) };
}

/**
 * The keys failed logins are counted under. A non-email identifier counts against both
 * its phone and Student Number forms, so re-spacing a phone can't dodge the limit.
 */
export function rateLimitKeys(id: ReturnType<typeof parseIdentifier>): string[] {
  if ("email" in id) return [id.email];
  return [...new Set([`phone:${id.phone}`, `student:${id.studentNumber}`])];
}

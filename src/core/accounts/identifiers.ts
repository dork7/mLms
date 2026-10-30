// How staff login identifiers (email or phone) are normalised before storing or matching.

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Keeps digits and an optional leading +, so "+971 50-123 4567" matches "+971501234567". */
export function normalisePhone(phone: string): string {
  const trimmed = phone.trim();
  return (trimmed.startsWith("+") ? "+" : "") + trimmed.replace(/\D/g, "");
}

/** A login identifier is an email if it contains "@", otherwise a phone number. */
export function parseIdentifier(identifier: string): { email: string } | { phone: string } {
  return identifier.includes("@")
    ? { email: normaliseEmail(identifier) }
    : { phone: normalisePhone(identifier) };
}

// Errors the application layer throws for expected refusals. The web layer maps
// them to UI messages via their `messageKey` (a translation key).

export class AccessDenied extends Error {
  readonly messageKey = "errors.accessDenied";
  constructor(reason = "access denied") {
    super(reason);
    this.name = "AccessDenied";
  }
}

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

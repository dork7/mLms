// Errors the application layer throws for expected refusals. The web layer maps
// them to UI messages via their `messageKey` (a translation key).

export class AccessDenied extends Error {
  readonly messageKey = "errors.accessDenied";
  constructor(reason = "access denied") {
    super(reason);
    this.name = "AccessDenied";
  }
}

// The Clock is the only source of "now" and "today" in the application layer.
// Never call `new Date()` for business logic; use ctx.clock.

export type Clock = {
  now(): Date;
  /** The school's calendar date, as YYYY-MM-DD. */
  today(): string;
};

const DEFAULT_TIME_ZONE = "Asia/Dubai";

function dateIn(timeZone: string, instant: Date): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(instant);
}

export function systemClock(timeZone = process.env.SCHOOL_TIME_ZONE ?? DEFAULT_TIME_ZONE): Clock {
  return {
    now: () => new Date(),
    today: () => dateIn(timeZone, new Date()),
  };
}

/** A Clock that stands still, for tests. Move it with `set`. */
export function fixedClock(iso: string, timeZone = DEFAULT_TIME_ZONE) {
  let instant = new Date(iso);
  return {
    now: () => new Date(instant),
    today: () => dateIn(timeZone, instant),
    set(next: string) {
      instant = new Date(next);
    },
  } satisfies Clock & { set(next: string): void };
}

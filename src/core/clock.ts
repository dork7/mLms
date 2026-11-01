// The Clock is the only source of "now" and "today" in the application layer.
// Never call `new Date()` for business logic; use ctx.clock.

export type Clock = {
  now(): Date;
  /** The school's calendar date, as YYYY-MM-DD. */
  today(): string;
  /** The instant of a wall-clock time at the school: a YYYY-MM-DD date, plus minutes since midnight. */
  at(date: string, minutes: number): Date;
};

const DEFAULT_TIME_ZONE = "Asia/Dubai";

/** The school's time zone: the one place that reads SCHOOL_TIME_ZONE and its default. */
export function schoolTimeZone(): string {
  return process.env.SCHOOL_TIME_ZONE ?? DEFAULT_TIME_ZONE;
}

function dateIn(timeZone: string, instant: Date): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(instant);
}

/** How far ahead of UTC the zone's wall clock is at this instant, in milliseconds. */
function offsetAt(timeZone: string, instant: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(instant);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wall = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
  return wall - Math.floor(instant / 1000) * 1000;
}

function instantIn(timeZone: string, date: string, minutes: number): Date {
  const [y, m, d] = date.split("-").map(Number);
  const wall = Date.UTC(y, m - 1, d, 0, minutes);
  // The offset is that of the instant being sought, so a second pass settles a daylight-saving change.
  const guess = wall - offsetAt(timeZone, wall);
  return new Date(wall - offsetAt(timeZone, guess));
}

export function systemClock(timeZone = schoolTimeZone()): Clock {
  return {
    now: () => new Date(),
    today: () => dateIn(timeZone, new Date()),
    at: (date, minutes) => instantIn(timeZone, date, minutes),
  };
}

/** A Clock that stands still, for tests. Move it with `set`. */
export function fixedClock(iso: string, timeZone = DEFAULT_TIME_ZONE) {
  let instant = new Date(iso);
  return {
    now: () => new Date(instant),
    today: () => dateIn(timeZone, instant),
    at: (date: string, minutes: number) => instantIn(timeZone, date, minutes),
    set(next: string) {
      instant = new Date(next);
    },
  } satisfies Clock & { set(next: string): void };
}

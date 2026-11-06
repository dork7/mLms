import { describe, expect, it } from "vitest";
import { fixedClock } from "./clock";

const NINE_AM = 9 * 60;

describe("the instant of a wall-clock time at the school", () => {
  it("uses the school's time zone", () => {
    const clock = fixedClock("2026-10-20T08:00:00+04:00", "Asia/Dubai");

    expect(clock.at("2026-11-10", NINE_AM).toISOString()).toBe("2026-11-10T05:00:00.000Z");
  });

  it("follows daylight saving", () => {
    const clock = fixedClock("2026-10-20T08:00:00Z", "Europe/London");

    expect(clock.at("2026-01-15", NINE_AM).toISOString()).toBe("2026-01-15T09:00:00.000Z");
    expect(clock.at("2026-07-15", NINE_AM).toISOString()).toBe("2026-07-15T08:00:00.000Z");
  });

  it("uses the offset of the moment itself on the day the clocks change", () => {
    const clock = fixedClock("2026-10-20T08:00:00Z", "Europe/London");

    // British Summer Time begins at 01:00 UTC on 2026-03-29, so midnight is still GMT.
    expect(clock.at("2026-03-29", 0).toISOString()).toBe("2026-03-29T00:00:00.000Z");
    expect(clock.at("2026-03-29", NINE_AM).toISOString()).toBe("2026-03-29T08:00:00.000Z");
  });

  it("settles the offset in a zone behind UTC, on the day the clocks change", () => {
    const clock = fixedClock("2026-10-20T08:00:00Z", "America/New_York");

    // Daylight saving begins at 07:00 UTC on 2026-03-08, so 03:30 there is 07:30 UTC (UTC-4).
    expect(clock.at("2026-03-08", 3 * 60 + 30).toISOString()).toBe("2026-03-08T07:30:00.000Z");
  });

  it("reads minute 1440 as the next midnight", () => {
    const clock = fixedClock("2026-10-20T08:00:00+04:00", "Asia/Dubai");

    expect(clock.at("2026-11-10", 24 * 60).toISOString()).toBe("2026-11-10T20:00:00.000Z");
  });
});

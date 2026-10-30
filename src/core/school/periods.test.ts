import { describe, expect, it } from "vitest";
import { testApp } from "../../../test/test-app";
import type { Actor } from "../context";
import { AccessDenied, InvalidPeriodsPerDay } from "../errors";
import { getPeriodsPerDay, setPeriodsPerDay } from "./periods";

describe("Periods per day", () => {
  it("is not set until the Admin sets it", async () => {
    const app = await testApp();
    const admin = await app.seedAdmin();

    expect(await getPeriodsPerDay(app.as(admin))).toBeNull();
  });

  it("the Admin sets the number of Periods per day, and can change it", async () => {
    const app = await testApp();
    const admin = await app.seedAdmin();

    await setPeriodsPerDay(app.as(admin), 7);
    expect(await getPeriodsPerDay(app.as(admin))).toBe(7);

    await setPeriodsPerDay(app.as(admin), 8);
    expect(await getPeriodsPerDay(app.as(admin))).toBe(8);
  });

  it.each([0, -1, 2.5, 21])("%s Periods per day is refused", async (n) => {
    const app = await testApp();
    const admin = await app.seedAdmin();

    await expect(setPeriodsPerDay(app.as(admin), n)).rejects.toThrow(InvalidPeriodsPerDay);
  });

  it("a Teacher is refused setting it, but can read it", async () => {
    const app = await testApp();
    const admin = await app.seedAdmin();
    await setPeriodsPerDay(app.as(admin), 6);
    const teacher: Actor = { role: "teacher", userId: "some-teacher" };

    await expect(setPeriodsPerDay(app.as(teacher), 8)).rejects.toThrow(AccessDenied);
    expect(await getPeriodsPerDay(app.as(teacher))).toBe(6);
  });
});

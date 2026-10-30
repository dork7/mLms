import { describe, expect, it } from "vitest";
import { testApp } from "../../../test/test-app";
import type { Actor } from "../context";
import { AccessDenied } from "../errors";
import { getAdminDashboard } from "./admin-dashboard";

describe("Admin dashboard", () => {
  it("shows the Admin their name and today's date from the Clock", async () => {
    const app = await testApp({ now: "2026-09-01T08:00:00+04:00" });
    const admin = await app.seedAdmin("Amina Office");

    const dashboard = await getAdminDashboard(app.as(admin));

    expect(dashboard).toEqual({ adminName: "Amina Office", today: "2026-09-01" });
  });

  it("is refused to a Teacher", async () => {
    const app = await testApp();
    const teacher: Actor = { role: "teacher", userId: "some-teacher" };

    await expect(getAdminDashboard(app.as(teacher))).rejects.toThrow(AccessDenied);
  });
});

import { describe, expect, it } from "vitest";
import { testApp } from "../../../test/test-app";
import { getAdminDashboard } from "../dashboard/admin-dashboard";
import { bootstrapAdmin } from "./bootstrap-admin";

describe("Bootstrapping the first Admin", () => {
  it("creates an Admin on a new school, and does nothing once one exists", async () => {
    const app = await testApp();

    const first = await bootstrapAdmin(app.deps, {
      name: "Amina Office",
      email: "amina@school.test",
      password: "correct horse battery",
    });
    const second = await bootstrapAdmin(app.deps, {
      name: "Someone Else",
      email: "else@school.test",
      password: "another password",
    });

    expect(first.created).toBe(true);
    expect(second).toEqual({ created: false, actor: first.actor });
    const dashboard = await getAdminDashboard(app.as(second.actor));
    expect(dashboard.adminName).toBe("Amina Office");
  });
});

import { describe, expect, it } from "vitest";
import { testApp } from "../../../test/test-app";
import { InvalidInput, InvalidResetToken, LoginFailed } from "../errors";
import { createTeacher } from "./create-teacher";
import { disableLogin } from "./disable-login";
import { logIn } from "./log-in";
import { requestPasswordReset, resetPassword } from "./password-reset";
import { sessionActor } from "./sessions";

const LINK = "https://lms.school.test/reset-password";

function tokenFrom(text: string): string {
  const match = text.match(/reset-password\?token=([\w-]+)/);
  if (!match) throw new Error(`no reset link in: ${text}`);
  return match[1];
}

async function schoolWithTeacher() {
  const app = await testApp({ now: "2026-09-01T08:00:00+04:00" });
  const admin = await app.seedAdmin();
  const teacher = await createTeacher(app.as(admin), { name: "Tariq Teacher", email: "tariq@school.test" });
  return { app, admin, ...teacher };
}

describe("Forgotten password reset", () => {
  it("a Teacher who forgot their password gets a reset link by email and sets a new password", async () => {
    const { app, initialPassword } = await schoolWithTeacher();
    const { token: oldSession } = await logIn(app.deps, {
      identifier: "tariq@school.test",
      password: initialPassword,
    });

    await requestPasswordReset(app.deps, { email: "Tariq@school.test", linkBase: LINK });

    expect(app.mailer.sent).toHaveLength(1);
    expect(app.mailer.sent[0]).toMatchObject({ to: "tariq@school.test", subject: "Reset your password" });
    const token = tokenFrom(app.mailer.sent[0].text);

    await expect(resetPassword(app.deps, { token, newPassword: "short" })).rejects.toThrow(InvalidInput);
    await resetPassword(app.deps, { token, newPassword: "my brand new password" });

    expect(await sessionActor(app.deps, oldSession)).toBeNull();
    await expect(
      logIn(app.deps, { identifier: "tariq@school.test", password: initialPassword }),
    ).rejects.toThrow(LoginFailed);
    const session = await logIn(app.deps, { identifier: "tariq@school.test", password: "my brand new password" });
    expect(session.mustChangePassword).toBe(false);
  });

  it("a reset link works only once", async () => {
    const { app } = await schoolWithTeacher();
    await requestPasswordReset(app.deps, { email: "tariq@school.test", linkBase: LINK });
    const token = tokenFrom(app.mailer.sent[0].text);

    await resetPassword(app.deps, { token, newPassword: "my brand new password" });

    await expect(resetPassword(app.deps, { token, newPassword: "another new password" })).rejects.toThrow(
      InvalidResetToken,
    );
  });

  it("a reset link expires after an hour", async () => {
    const { app } = await schoolWithTeacher();
    await requestPasswordReset(app.deps, { email: "tariq@school.test", linkBase: LINK });
    const token = tokenFrom(app.mailer.sent[0].text);

    app.clock.set("2026-09-01T09:01:00+04:00");

    await expect(resetPassword(app.deps, { token, newPassword: "my brand new password" })).rejects.toThrow(
      InvalidResetToken,
    );
    await expect(
      resetPassword(app.deps, { token: "made-up", newPassword: "my brand new password" }),
    ).rejects.toThrow(InvalidResetToken);
  });

  it("no email is sent for an unknown address or a disabled login, and the request looks the same", async () => {
    const { app, admin, teacherId } = await schoolWithTeacher();
    await disableLogin(app.as(admin), { userId: teacherId });

    await requestPasswordReset(app.deps, { email: "nobody@school.test", linkBase: LINK });
    await requestPasswordReset(app.deps, { email: "tariq@school.test", linkBase: LINK });

    expect(app.mailer.sent).toEqual([]);
  });
});

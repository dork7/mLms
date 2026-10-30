import { describe, expect, it } from "vitest";
import { testApp } from "../../../test/test-app";
import { AccessDenied, DuplicateLogin, InvalidInput, LoginFailed, TooManyLoginAttempts } from "../errors";
import { changePassword } from "./change-password";
import { createTeacher } from "./create-teacher";
import { disableLogin, enableLogin } from "./disable-login";
import { listTeachers } from "./list-teachers";
import { logIn } from "./log-in";
import { logOut, sessionActor } from "./sessions";

describe("Staff accounts", () => {
  it("an Admin creates a Teacher, who logs in by email and must change the initial password", async () => {
    const app = await testApp();
    const admin = await app.seedAdmin();

    const { teacherId, initialPassword } = await createTeacher(app.as(admin), {
      name: "Tariq Teacher",
      email: "Tariq@School.test",
    });
    const session = await logIn(app.deps, { identifier: "tariq@school.test", password: initialPassword });

    expect(session.actor).toEqual({ role: "teacher", userId: teacherId });
    expect(session.mustChangePassword).toBe(true);
  });

  it("a Teacher created with only a phone logs in with it, however it is spaced", async () => {
    const app = await testApp();
    const admin = await app.seedAdmin();

    const { teacherId, initialPassword } = await createTeacher(app.as(admin), {
      name: "Huda Teacher",
      phone: "+971 50 123 4567",
    });
    const session = await logIn(app.deps, { identifier: "+971-50-1234567", password: initialPassword });

    expect(session.actor).toEqual({ role: "teacher", userId: teacherId });
  });

  it("a second Teacher with the same email or phone is refused", async () => {
    const app = await testApp();
    const admin = await app.seedAdmin();
    await createTeacher(app.as(admin), { name: "First", email: "same@school.test", phone: "0501112222" });

    await expect(
      createTeacher(app.as(admin), { name: "Second", email: "SAME@school.test" }),
    ).rejects.toThrow(DuplicateLogin);
    await expect(
      createTeacher(app.as(admin), { name: "Third", phone: "050 111 2222" }),
    ).rejects.toThrow(DuplicateLogin);
  });

  it("a Teacher needs a name and an email or phone", async () => {
    const app = await testApp();
    const admin = await app.seedAdmin();

    await expect(createTeacher(app.as(admin), { name: "No Contact" })).rejects.toThrow(InvalidInput);
    await expect(createTeacher(app.as(admin), { name: " ", email: "x@school.test" })).rejects.toThrow(
      InvalidInput,
    );
  });

  it("after changing the initial password, only the new one works and no change is required", async () => {
    const app = await testApp();
    const admin = await app.seedAdmin();
    const { initialPassword } = await createTeacher(app.as(admin), { name: "Tariq", email: "tariq@school.test" });
    const first = await logIn(app.deps, { identifier: "tariq@school.test", password: initialPassword });

    await expect(
      changePassword(app.as(first.actor), { currentPassword: initialPassword, newPassword: "short" }),
    ).rejects.toThrow(InvalidInput);
    await expect(
      changePassword(app.as(first.actor), { currentPassword: "wrong", newPassword: "a long new password" }),
    ).rejects.toThrow(InvalidInput);
    await changePassword(app.as(first.actor), {
      currentPassword: initialPassword,
      newPassword: "a long new password",
    });

    expect(await sessionActor(app.deps, first.token)).toEqual({
      actor: first.actor,
      mustChangePassword: false,
    });
    await expect(
      logIn(app.deps, { identifier: "tariq@school.test", password: initialPassword }),
    ).rejects.toThrow(LoginFailed);
    const second = await logIn(app.deps, { identifier: "tariq@school.test", password: "a long new password" });
    expect(second.mustChangePassword).toBe(false);
  });

  it("a session times out after 8 idle hours, but each use keeps it alive", async () => {
    const app = await testApp({ now: "2026-09-01T08:00:00+04:00" });
    const admin = await app.seedAdmin();
    const { initialPassword } = await createTeacher(app.as(admin), { name: "Tariq", email: "tariq@school.test" });
    const { token, actor } = await logIn(app.deps, { identifier: "tariq@school.test", password: initialPassword });

    app.clock.set("2026-09-01T15:00:00+04:00");
    expect((await sessionActor(app.deps, token))?.actor).toEqual(actor);
    app.clock.set("2026-09-01T22:59:00+04:00");
    expect((await sessionActor(app.deps, token))?.actor).toEqual(actor);
    app.clock.set("2026-09-02T07:00:00+04:00");
    expect(await sessionActor(app.deps, token)).toBeNull();
  });

  it("a logged-out session no longer works", async () => {
    const app = await testApp();
    const admin = await app.seedAdmin();
    const { initialPassword } = await createTeacher(app.as(admin), { name: "Tariq", email: "tariq@school.test" });
    const { token } = await logIn(app.deps, { identifier: "tariq@school.test", password: initialPassword });

    await logOut(app.deps, token);

    expect(await sessionActor(app.deps, token)).toBeNull();
    expect(await sessionActor(app.deps, "made-up-token")).toBeNull();
  });

  it("after 5 failed logins in 15 minutes, even the right password is refused until 15 minutes pass", async () => {
    const app = await testApp({ now: "2026-09-01T08:00:00+04:00" });
    const admin = await app.seedAdmin();
    const { initialPassword } = await createTeacher(app.as(admin), { name: "Tariq", email: "tariq@school.test" });
    const right = { identifier: "tariq@school.test", password: initialPassword };
    const wrong = { identifier: "TARIQ@school.test", password: "guess" };

    for (let i = 0; i < 5; i++) await expect(logIn(app.deps, wrong)).rejects.toThrow(LoginFailed);
    await expect(logIn(app.deps, right)).rejects.toThrow(TooManyLoginAttempts);

    app.clock.set("2026-09-01T08:16:00+04:00");
    await expect(logIn(app.deps, right)).resolves.toMatchObject({ mustChangePassword: true });
  });

  it("a successful login clears earlier failures", async () => {
    const app = await testApp({ now: "2026-09-01T08:00:00+04:00" });
    const admin = await app.seedAdmin();
    const { initialPassword } = await createTeacher(app.as(admin), { name: "Tariq", email: "tariq@school.test" });
    const right = { identifier: "tariq@school.test", password: initialPassword };
    const wrong = { identifier: "tariq@school.test", password: "guess" };

    for (let i = 0; i < 4; i++) await expect(logIn(app.deps, wrong)).rejects.toThrow(LoginFailed);
    await logIn(app.deps, right);
    for (let i = 0; i < 4; i++) await expect(logIn(app.deps, wrong)).rejects.toThrow(LoginFailed);

    await expect(logIn(app.deps, right)).resolves.toBeDefined();
  });

  it("a disabled Teacher can't log in and their session ends, but they stay on the staff list", async () => {
    const app = await testApp();
    const admin = await app.seedAdmin();
    const { teacherId, initialPassword } = await createTeacher(app.as(admin), {
      name: "Tariq",
      email: "tariq@school.test",
      phone: "0501112222",
    });
    const { token } = await logIn(app.deps, { identifier: "tariq@school.test", password: initialPassword });

    await disableLogin(app.as(admin), { userId: teacherId });

    expect(await sessionActor(app.deps, token)).toBeNull();
    await expect(
      logIn(app.deps, { identifier: "tariq@school.test", password: initialPassword }),
    ).rejects.toThrow(LoginFailed);
    expect(await listTeachers(app.as(admin))).toEqual([
      { id: teacherId, name: "Tariq", email: "tariq@school.test", phone: "0501112222", disabled: true },
    ]);

    await enableLogin(app.as(admin), { userId: teacherId });
    await expect(
      logIn(app.deps, { identifier: "tariq@school.test", password: initialPassword }),
    ).resolves.toBeDefined();
    expect((await listTeachers(app.as(admin)))[0].disabled).toBe(false);
  });

  it("only an Admin can create, list, disable or enable staff accounts", async () => {
    const app = await testApp();
    const admin = await app.seedAdmin();
    const { teacherId, initialPassword } = await createTeacher(app.as(admin), {
      name: "Tariq",
      email: "tariq@school.test",
    });
    const { actor: teacher } = await logIn(app.deps, { identifier: "tariq@school.test", password: initialPassword });

    await expect(createTeacher(app.as(teacher), { name: "Sneaky", email: "s@school.test" })).rejects.toThrow(
      AccessDenied,
    );
    await expect(listTeachers(app.as(teacher))).rejects.toThrow(AccessDenied);
    await expect(disableLogin(app.as(teacher), { userId: teacherId })).rejects.toThrow(AccessDenied);
    await expect(enableLogin(app.as(teacher), { userId: teacherId })).rejects.toThrow(AccessDenied);
  });

  it("an Admin can't disable their own login", async () => {
    const app = await testApp();
    const admin = await app.seedAdmin();

    await expect(disableLogin(app.as(admin), { userId: admin.userId })).rejects.toThrow(InvalidInput);
  });

  it("a wrong password is refused", async () => {
    const app = await testApp();
    const admin = await app.seedAdmin();
    await createTeacher(app.as(admin), { name: "Tariq", email: "tariq@school.test" });

    await expect(
      logIn(app.deps, { identifier: "tariq@school.test", password: "guess" }),
    ).rejects.toThrow(LoginFailed);
    await expect(
      logIn(app.deps, { identifier: "nobody@school.test", password: "guess" }),
    ).rejects.toThrow(LoginFailed);
  });
});

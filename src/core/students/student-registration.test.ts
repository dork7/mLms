import { describe, expect, it } from "vitest";
import { testApp } from "../../../test/test-app";
import { changePassword } from "../accounts/change-password";
import { createTeacher } from "../accounts/create-teacher";
import { disableLogin, enableLogin } from "../accounts/disable-login";
import { logIn } from "../accounts/log-in";
import { sessionActor } from "../accounts/sessions";
import { AccessDenied, InvalidInput, LoginFailed, NotFound, StudentNumberTaken, TooManyLoginAttempts } from "../errors";
import { listStudents } from "./list-students";
import { getStudentPhoto, getStudentProfile } from "./student-profile";
import { registerStudent, type RegisterStudentInput } from "./register-student";
import { resetStudentPassword } from "./reset-student-password";

const aisha: RegisterStudentInput = {
  name: "Aisha Rahman",
  dateOfBirth: "2013-04-12",
  nationalId: "784-2013-1234567-1",
  guardianContact: "Fatima Rahman, +971 50 765 4321",
  email: "rahman.family@example.test",
  admissionDate: "2026-08-25",
  studentNumber: "S-1024",
};

describe("Student registration", () => {
  it("an Admin registers a Student, who logs in with their Student Number and must change the password", async () => {
    const app = await testApp();
    const admin = await app.seedAdmin();

    const { studentId, initialPassword } = await registerStudent(app.as(admin), aisha);
    const session = await logIn(app.deps, { identifier: "s-1024", password: initialPassword });

    expect(session.actor).toEqual({ role: "student", userId: studentId });
    expect(session.mustChangePassword).toBe(true);
  });

  it("a second Student with the same Student Number is refused, whatever its case or spacing", async () => {
    const app = await testApp();
    const admin = await app.seedAdmin();
    await registerStudent(app.as(admin), aisha);

    await expect(
      registerStudent(app.as(admin), { ...aisha, name: "Other", studentNumber: " s-1024 " }),
    ).rejects.toThrow(StudentNumberTaken);
  });

  it("siblings may share one guardian email, and a Student may have none", async () => {
    const app = await testApp();
    const admin = await app.seedAdmin();
    await registerStudent(app.as(admin), aisha);

    await registerStudent(app.as(admin), { ...aisha, name: "Omar Rahman", studentNumber: "S-1025" });
    await registerStudent(app.as(admin), { ...aisha, name: "Lina", studentNumber: "S-1026", email: "" });
  });

  it("a Student needs a name, Student Number, dates of birth and admission, national ID and guardian contact", async () => {
    const app = await testApp();
    const admin = await app.seedAdmin();

    for (const missing of [
      { name: " " },
      { studentNumber: "" },
      { dateOfBirth: "" },
      { admissionDate: "2026-13-40" },
      { nationalId: "" },
      { guardianContact: "" },
    ]) {
      await expect(registerStudent(app.as(admin), { ...aisha, ...missing })).rejects.toThrow(InvalidInput);
    }
  });

  it("only an Admin may register a Student", async () => {
    const app = await testApp();
    const admin = await app.seedAdmin();
    const { teacherId } = await createTeacher(app.as(admin), { name: "Tariq", email: "tariq@school.test" });

    await expect(
      registerStudent(app.as({ role: "teacher", userId: teacherId }), aisha),
    ).rejects.toThrow(AccessDenied);
  });

  it("a Student logs in with the new password after changing the initial one", async () => {
    const app = await testApp();
    const admin = await app.seedAdmin();
    const { initialPassword } = await registerStudent(app.as(admin), aisha);
    const first = await logIn(app.deps, { identifier: "S-1024", password: initialPassword });

    await changePassword(app.as(first.actor), {
      currentPassword: initialPassword,
      newPassword: "aisha's own password",
    });

    const again = await logIn(app.deps, { identifier: "S-1024", password: "aisha's own password" });
    expect(again.mustChangePassword).toBe(false);
    await expect(logIn(app.deps, { identifier: "S-1024", password: initialPassword })).rejects.toThrow(
      LoginFailed,
    );
  });
});

describe("Student login protection", () => {
  it("five failed logins lock a Student Number in any case for 15 minutes", async () => {
    const app = await testApp();
    const admin = await app.seedAdmin();
    const { initialPassword } = await registerStudent(app.as(admin), aisha);

    for (let i = 0; i < 5; i++) {
      await expect(logIn(app.deps, { identifier: i % 2 ? "s-1024" : "S-1024", password: "guess" })).rejects.toThrow(
        LoginFailed,
      );
    }
    await expect(logIn(app.deps, { identifier: "s-1024", password: initialPassword })).rejects.toThrow(
      TooManyLoginAttempts,
    );

    app.clock.set("2026-09-01T08:16:00+04:00");
    await logIn(app.deps, { identifier: "s-1024", password: initialPassword });
  });
});

describe("Student profile", () => {
  const photo = { contentType: "image/png", data: new Uint8Array([137, 80, 78, 71, 1, 2, 3]) };

  it("a Student sees their own profile and photo", async () => {
    const app = await testApp();
    const admin = await app.seedAdmin();
    const { studentId } = await registerStudent(app.as(admin), { ...aisha, photo });
    const me = app.as({ role: "student", userId: studentId });

    expect(await getStudentProfile(me, { studentId })).toEqual({
      id: studentId,
      name: "Aisha Rahman",
      studentNumber: "S-1024",
      dateOfBirth: "2013-04-12",
      nationalId: "784-2013-1234567-1",
      guardianContact: "Fatima Rahman, +971 50 765 4321",
      email: "rahman.family@example.test",
      admissionDate: "2026-08-25",
      hasPhoto: true,
      disabled: false,
      enrollments: [],
    });
    const stored = await getStudentPhoto(me, { studentId });
    expect(stored?.contentType).toBe("image/png");
    expect([...stored!.data]).toEqual([137, 80, 78, 71, 1, 2, 3]);
  });

  it("a Student is refused another Student's profile and photo", async () => {
    const app = await testApp();
    const admin = await app.seedAdmin();
    const { studentId: aishaId } = await registerStudent(app.as(admin), { ...aisha, photo });
    const { studentId: omarId } = await registerStudent(app.as(admin), {
      ...aisha,
      name: "Omar",
      studentNumber: "S-1025",
    });
    const omar = app.as({ role: "student", userId: omarId });

    await expect(getStudentProfile(omar, { studentId: aishaId })).rejects.toThrow(AccessDenied);
    await expect(getStudentPhoto(omar, { studentId: aishaId })).rejects.toThrow(AccessDenied);
  });

  it("the Admin sees any Student's profile; a Student without a photo has none", async () => {
    const app = await testApp();
    const admin = await app.seedAdmin();
    const { studentId } = await registerStudent(app.as(admin), aisha);

    expect((await getStudentProfile(app.as(admin), { studentId })).hasPhoto).toBe(false);
    expect(await getStudentPhoto(app.as(admin), { studentId })).toBeNull();
    await expect(getStudentProfile(app.as(admin), { studentId: "no-such-student" })).rejects.toThrow(NotFound);
  });

  it("a photo must be a JPEG, PNG or WebP image of at most 2 MB", async () => {
    const app = await testApp();
    const admin = await app.seedAdmin();

    await expect(
      registerStudent(app.as(admin), { ...aisha, photo: { contentType: "application/pdf", data: photo.data } }),
    ).rejects.toThrow(InvalidInput);
    await expect(
      registerStudent(app.as(admin), {
        ...aisha,
        photo: { contentType: "image/jpeg", data: new Uint8Array(2 * 1024 * 1024 + 1) },
      }),
    ).rejects.toThrow(InvalidInput);
  });
});

describe("Student login management", () => {
  it("an Admin resets a Student's password: the old one stops working and the new one must be changed", async () => {
    const app = await testApp();
    const admin = await app.seedAdmin();
    const { studentId, initialPassword } = await registerStudent(app.as(admin), aisha);
    const first = await logIn(app.deps, { identifier: "S-1024", password: initialPassword });
    await changePassword(app.as(first.actor), {
      currentPassword: initialPassword,
      newPassword: "aisha's own password",
    });

    const { newPassword } = await resetStudentPassword(app.as(admin), { studentId });

    expect(await sessionActor(app.deps, first.token)).toBeNull();
    await expect(
      logIn(app.deps, { identifier: "S-1024", password: "aisha's own password" }),
    ).rejects.toThrow(LoginFailed);
    const after = await logIn(app.deps, { identifier: "S-1024", password: newPassword });
    expect(after.mustChangePassword).toBe(true);
  });

  it("only an Admin resets a Student's password, and only a Student's", async () => {
    const app = await testApp();
    const admin = await app.seedAdmin();
    const { studentId } = await registerStudent(app.as(admin), aisha);
    const { teacherId } = await createTeacher(app.as(admin), { name: "Tariq", email: "tariq@school.test" });

    await expect(
      resetStudentPassword(app.as({ role: "student", userId: studentId }), { studentId }),
    ).rejects.toThrow(AccessDenied);
    await expect(resetStudentPassword(app.as(admin), { studentId: teacherId })).rejects.toThrow(NotFound);
  });

  it("a disabled Student can't log in, and re-enabling restores the login", async () => {
    const app = await testApp();
    const admin = await app.seedAdmin();
    const { studentId, initialPassword } = await registerStudent(app.as(admin), aisha);
    const session = await logIn(app.deps, { identifier: "S-1024", password: initialPassword });

    await disableLogin(app.as(admin), { userId: studentId });

    expect(await sessionActor(app.deps, session.token)).toBeNull();
    await expect(logIn(app.deps, { identifier: "S-1024", password: initialPassword })).rejects.toThrow(
      LoginFailed,
    );
    expect((await listStudents(app.as(admin))).map((s) => [s.studentNumber, s.disabled])).toEqual([
      ["S-1024", true],
    ]);

    await enableLogin(app.as(admin), { userId: studentId });
    await logIn(app.deps, { identifier: "S-1024", password: initialPassword });
  });
});

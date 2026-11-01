import { describe, expect, it } from "vitest";
import { testApp } from "../../../test/test-app";
import type { Actor } from "../context";
import { AccessDenied, NameTaken, NotFound } from "../errors";
import {
  createGrade,
  createRoom,
  createSubject,
  listGrades,
  listGradesInOrder,
  listRooms,
  listSubjects,
  renameGrade,
  renameRoom,
  renameSubject,
  setGradeOrder,
} from "./catalogue";

const kinds = [
  { kind: "Grade", create: createGrade, rename: renameGrade, list: listGrades, a: "Grade 7", b: "Grade 8" },
  { kind: "Subject", create: createSubject, rename: renameSubject, list: listSubjects, a: "Math", b: "Science" },
  { kind: "Room", create: createRoom, rename: renameRoom, list: listRooms, a: "Hall A", b: "Lab 2" },
];

describe.each(kinds)("$kind", ({ create, rename, list, a, b }) => {
  it("the Admin creates them and sees them listed by name", async () => {
    const app = await testApp();
    const admin = await app.seedAdmin();

    await create(app.as(admin), { name: b });
    await create(app.as(admin), { name: a });

    expect((await list(app.as(admin))).map((x) => x.name)).toEqual([a, b]);
  });

  it("the Admin edits one's name", async () => {
    const app = await testApp();
    const admin = await app.seedAdmin();
    const { id } = await create(app.as(admin), { name: a });

    await rename(app.as(admin), { id, name: `${a} (new)` });

    expect(await list(app.as(admin))).toEqual([{ id, name: `${a} (new)` }]);
  });

  it("a duplicate name is refused, on create and on edit", async () => {
    const app = await testApp();
    const admin = await app.seedAdmin();
    await create(app.as(admin), { name: a });
    const { id } = await create(app.as(admin), { name: b });

    await expect(create(app.as(admin), { name: ` ${a} ` })).rejects.toThrow(NameTaken);
    await expect(rename(app.as(admin), { id, name: a })).rejects.toThrow(NameTaken);
  });

  it("editing one that doesn't exist is refused", async () => {
    const app = await testApp();
    const admin = await app.seedAdmin();

    await expect(rename(app.as(admin), { id: 999, name: a })).rejects.toThrow(NotFound);
  });

  it("a Teacher is refused creating or editing, but can see the list", async () => {
    const app = await testApp();
    const admin = await app.seedAdmin();
    const { id } = await create(app.as(admin), { name: a });
    const teacher: Actor = { role: "teacher", userId: "some-teacher" };

    await expect(create(app.as(teacher), { name: b })).rejects.toThrow(AccessDenied);
    await expect(rename(app.as(teacher), { id, name: b })).rejects.toThrow(AccessDenied);
    expect(await list(app.as(teacher))).toEqual([{ id, name: a }]);
  });
});

describe("the order of Grades", () => {
  async function grades() {
    const app = await testApp();
    const asAdmin = app.as(await app.seedAdmin());
    const grade7 = await createGrade(asAdmin, { name: "Grade 7" });
    const grade10 = await createGrade(asAdmin, { name: "Grade 10" });
    const grade8 = await createGrade(asAdmin, { name: "Grade 8" });
    return { app, asAdmin, grade7, grade8, grade10 };
  }

  it("a new Grade has no order, and those come after the ordered ones by name", async () => {
    const s = await grades();

    await setGradeOrder(s.asAdmin, { gradeId: s.grade10.id, order: 10 });
    await setGradeOrder(s.asAdmin, { gradeId: s.grade8.id, order: 8 });

    expect(await listGradesInOrder(s.asAdmin)).toEqual([
      { id: s.grade8.id, name: "Grade 8", order: 8 },
      { id: s.grade10.id, name: "Grade 10", order: 10 },
      { id: s.grade7.id, name: "Grade 7", order: null },
    ]);
  });

  it("the Admin can change an order or clear it", async () => {
    const s = await grades();
    await setGradeOrder(s.asAdmin, { gradeId: s.grade8.id, order: 8 });

    await setGradeOrder(s.asAdmin, { gradeId: s.grade8.id, order: 3 });
    expect((await listGradesInOrder(s.asAdmin)).find((g) => g.id === s.grade8.id)?.order).toBe(3);

    await setGradeOrder(s.asAdmin, { gradeId: s.grade8.id, order: null });
    expect((await listGradesInOrder(s.asAdmin)).find((g) => g.id === s.grade8.id)?.order).toBeNull();
  });

  it("two Grades can't share an order, though any number of them can have none", async () => {
    const s = await grades();
    await setGradeOrder(s.asAdmin, { gradeId: s.grade7.id, order: 7 });

    await expect(setGradeOrder(s.asAdmin, { gradeId: s.grade8.id, order: 7 })).rejects.toMatchObject({
      messageKey: "errors.gradeOrderTaken",
    });
    await setGradeOrder(s.asAdmin, { gradeId: s.grade8.id, order: null });
    await setGradeOrder(s.asAdmin, { gradeId: s.grade10.id, order: null });
  });

  it.each([[0], [-1], [1.5], [Number.NaN], [1001]])("refuses %s as an order", async (order) => {
    const s = await grades();

    await expect(setGradeOrder(s.asAdmin, { gradeId: s.grade7.id, order })).rejects.toMatchObject({
      messageKey: "errors.gradeOrderInvalid",
    });
  });

  it("refuses a Grade that doesn't exist, and a Teacher", async () => {
    const s = await grades();
    const teacher = s.app.as({ role: "teacher", userId: "some-teacher" });

    await expect(setGradeOrder(s.asAdmin, { gradeId: 99999, order: 1 })).rejects.toThrow(NotFound);
    await expect(setGradeOrder(teacher, { gradeId: s.grade7.id, order: 1 })).rejects.toThrow(AccessDenied);
  });
});

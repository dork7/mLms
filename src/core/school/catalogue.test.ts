import { describe, expect, it } from "vitest";
import { testApp } from "../../../test/test-app";
import type { Actor } from "../context";
import { AccessDenied, NameTaken, NotFound } from "../errors";
import {
  createGrade,
  createRoom,
  createSubject,
  listGrades,
  listRooms,
  listSubjects,
  renameGrade,
  renameRoom,
  renameSubject,
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

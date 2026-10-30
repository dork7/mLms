import { describe, expect, it } from "vitest";
import { AccessDenied, InvalidInput, NameTaken } from "../errors";
import { createClass, listClasses } from "./classes";
import { school } from "./test-school";

describe("Classes", () => {
  it("the Admin creates a Class for a Grade with a Class Teacher and sees it listed", async () => {
    const { asAdmin, year, grade7, huda } = await school();

    const { id } = await createClass(asAdmin, {
      academicYearId: year.id,
      gradeId: grade7.id,
      name: " 7-A ",
      classTeacherId: huda.userId,
    });

    expect(await listClasses(asAdmin)).toEqual([
      {
        id,
        name: "7-A",
        academicYearId: year.id,
        academicYear: "2026-2027",
        gradeId: grade7.id,
        grade: "Grade 7",
        classTeacherId: huda.userId,
        classTeacher: "Huda",
      },
    ]);
  });

  it("a second Class with the same name in the same Academic Year is refused", async () => {
    const { asAdmin, year, grade7, huda, omar } = await school();
    const input = { academicYearId: year.id, gradeId: grade7.id, name: "7-A", classTeacherId: huda.userId };
    await createClass(asAdmin, input);

    await expect(createClass(asAdmin, { ...input, name: " 7-A", classTeacherId: omar.userId })).rejects.toThrow(
      NameTaken,
    );
  });

  it("a Class needs a name", async () => {
    const { asAdmin, year, grade7, huda } = await school();

    await expect(
      createClass(asAdmin, { academicYearId: year.id, gradeId: grade7.id, name: "  ", classTeacherId: huda.userId }),
    ).rejects.toThrow(new InvalidInput("errors.nameRequired"));
  });

  it("the Class Teacher must be a Teacher", async () => {
    const { asAdmin, admin, year, grade7 } = await school();
    const input = { academicYearId: year.id, gradeId: grade7.id, name: "7-A" };

    await expect(createClass(asAdmin, { ...input, classTeacherId: admin.userId })).rejects.toThrow(
      new InvalidInput("errors.notATeacher"),
    );
    await expect(createClass(asAdmin, { ...input, classTeacherId: "nobody" })).rejects.toThrow(
      new InvalidInput("errors.notATeacher"),
    );
  });

  it("a Teacher is refused creating a Class or listing every Class", async () => {
    const { app, year, grade7, huda } = await school();

    await expect(
      createClass(app.as(huda), { academicYearId: year.id, gradeId: grade7.id, name: "7-A", classTeacherId: huda.userId }),
    ).rejects.toThrow(AccessDenied);
    await expect(listClasses(app.as(huda))).rejects.toThrow(AccessDenied);
  });
});

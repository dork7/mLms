import { describe, expect, it } from "vitest";
import { testApp } from "../../../test/test-app";
import type { Actor } from "../context";
import { AccessDenied, AcademicYearsOverlap, NameTaken, NotFound, TermsDoNotCoverYear } from "../errors";
import { createAcademicYear, termOn, updateAcademicYear } from "./academic-year";

const year2026 = {
  name: "2026-2027",
  startDate: "2026-09-01",
  endDate: "2027-06-30",
  terms: [
    { name: "Term 1", startDate: "2026-09-01", endDate: "2026-12-31" },
    { name: "Term 2", startDate: "2027-01-01", endDate: "2027-03-31" },
    { name: "Term 3", startDate: "2027-04-01", endDate: "2027-06-30" },
  ],
};

describe("Academic Year and Terms", () => {
  it("the Admin creates an Academic Year whose Terms cover it, and any date in it falls in one Term", async () => {
    const app = await testApp();
    const admin = await app.seedAdmin();

    await createAcademicYear(app.as(admin), year2026);

    expect(await termOn(app.as(admin), "2026-09-01")).toMatchObject({ name: "Term 1", academicYear: "2026-2027" });
    expect(await termOn(app.as(admin), "2026-12-31")).toMatchObject({ name: "Term 1" });
    expect(await termOn(app.as(admin), "2027-01-01")).toMatchObject({ name: "Term 2" });
    expect(await termOn(app.as(admin), "2027-06-30")).toMatchObject({
      name: "Term 3",
      startDate: "2027-04-01",
      endDate: "2027-06-30",
    });
    expect(await termOn(app.as(admin), "2027-07-01")).toBeNull();
  });

  it.each([
    [
      "a gap between Terms",
      [
        { name: "Term 1", startDate: "2026-09-01", endDate: "2026-12-20" },
        { name: "Term 2", startDate: "2027-01-01", endDate: "2027-06-30" },
      ],
    ],
    [
      "overlapping Terms",
      [
        { name: "Term 1", startDate: "2026-09-01", endDate: "2027-01-10" },
        { name: "Term 2", startDate: "2027-01-01", endDate: "2027-06-30" },
      ],
    ],
    [
      "Terms starting after the year starts",
      [
        { name: "Term 1", startDate: "2026-09-05", endDate: "2026-12-31" },
        { name: "Term 2", startDate: "2027-01-01", endDate: "2027-06-30" },
      ],
    ],
    [
      "Terms ending before the year ends",
      [
        { name: "Term 1", startDate: "2026-09-01", endDate: "2026-12-31" },
        { name: "Term 2", startDate: "2027-01-01", endDate: "2027-06-15" },
      ],
    ],
    [
      "a Term that ends before it starts",
      [
        { name: "Term 1", startDate: "2026-09-01", endDate: "2026-12-31" },
        { name: "Term 2", startDate: "2027-01-01", endDate: "2026-12-31" },
        { name: "Term 3", startDate: "2027-01-01", endDate: "2027-06-30" },
      ],
    ],
    ["no Terms at all", []],
  ])("an Academic Year with %s is refused, and nothing is saved", async (_, terms) => {
    const app = await testApp();
    const admin = await app.seedAdmin();

    await expect(createAcademicYear(app.as(admin), { ...year2026, terms })).rejects.toThrow(TermsDoNotCoverYear);

    expect(await termOn(app.as(admin), "2026-10-01")).toBeNull();
  });

  it("Terms given out of order are accepted when together they cover the year", async () => {
    const app = await testApp();
    const admin = await app.seedAdmin();

    await createAcademicYear(app.as(admin), { ...year2026, terms: [...year2026.terms].reverse() });

    expect(await termOn(app.as(admin), "2027-02-14")).toMatchObject({ name: "Term 2" });
  });

  it("an Academic Year that overlaps an existing one is refused", async () => {
    const app = await testApp();
    const admin = await app.seedAdmin();
    await createAcademicYear(app.as(admin), year2026);

    await expect(
      createAcademicYear(app.as(admin), {
        name: "2027-2028",
        startDate: "2027-06-01",
        endDate: "2028-06-30",
        terms: [{ name: "Only Term", startDate: "2027-06-01", endDate: "2028-06-30" }],
      }),
    ).rejects.toThrow(AcademicYearsOverlap);
  });

  it("a second Academic Year with the same name is refused", async () => {
    const app = await testApp();
    const admin = await app.seedAdmin();
    await createAcademicYear(app.as(admin), year2026);

    await expect(
      createAcademicYear(app.as(admin), {
        name: "2026-2027",
        startDate: "2027-07-01",
        endDate: "2028-06-30",
        terms: [{ name: "Only Term", startDate: "2027-07-01", endDate: "2028-06-30" }],
      }),
    ).rejects.toThrow(NameTaken);
  });

  it("the next Academic Year can start the day after the previous one ends", async () => {
    const app = await testApp();
    const admin = await app.seedAdmin();
    await createAcademicYear(app.as(admin), year2026);

    await createAcademicYear(app.as(admin), {
      name: "2027-2028",
      startDate: "2027-07-01",
      endDate: "2028-06-30",
      terms: [{ name: "Only Term", startDate: "2027-07-01", endDate: "2028-06-30" }],
    });

    expect(await termOn(app.as(admin), "2027-07-01")).toMatchObject({ academicYear: "2027-2028" });
  });

  it("the Admin edits an Academic Year's name and Terms, and dates then fall in the new Terms", async () => {
    const app = await testApp();
    const admin = await app.seedAdmin();
    const { id } = await createAcademicYear(app.as(admin), year2026);

    await updateAcademicYear(app.as(admin), {
      id,
      name: "AY 2026-27",
      startDate: "2026-09-01",
      endDate: "2027-06-30",
      terms: [
        { name: "Semester 1", startDate: "2026-09-01", endDate: "2027-01-31" },
        { name: "Semester 2", startDate: "2027-02-01", endDate: "2027-06-30" },
      ],
    });

    expect(await termOn(app.as(admin), "2027-01-15")).toMatchObject({
      name: "Semester 1",
      academicYear: "AY 2026-27",
    });
  });

  it("editing an Academic Year so its Terms leave a gap is refused, and the old Terms stay", async () => {
    const app = await testApp();
    const admin = await app.seedAdmin();
    const { id } = await createAcademicYear(app.as(admin), year2026);

    await expect(
      updateAcademicYear(app.as(admin), {
        id,
        ...year2026,
        terms: [{ name: "Short", startDate: "2026-09-01", endDate: "2026-12-31" }],
      }),
    ).rejects.toThrow(TermsDoNotCoverYear);

    expect(await termOn(app.as(admin), "2027-02-01")).toMatchObject({ name: "Term 2" });
  });

  it("editing an Academic Year so it overlaps another is refused", async () => {
    const app = await testApp();
    const admin = await app.seedAdmin();
    await createAcademicYear(app.as(admin), year2026);
    const { id } = await createAcademicYear(app.as(admin), {
      name: "2027-2028",
      startDate: "2027-07-01",
      endDate: "2028-06-30",
      terms: [{ name: "Only Term", startDate: "2027-07-01", endDate: "2028-06-30" }],
    });

    await expect(
      updateAcademicYear(app.as(admin), {
        id,
        name: "2027-2028",
        startDate: "2027-06-01",
        endDate: "2028-06-30",
        terms: [{ name: "Only Term", startDate: "2027-06-01", endDate: "2028-06-30" }],
      }),
    ).rejects.toThrow(AcademicYearsOverlap);
  });

  it("editing an Academic Year that doesn't exist is refused", async () => {
    const app = await testApp();
    const admin = await app.seedAdmin();

    await expect(updateAcademicYear(app.as(admin), { id: 999, ...year2026 })).rejects.toThrow(NotFound);
  });

  it("a Teacher is refused creating an Academic Year, but can ask which Term a date falls in", async () => {
    const app = await testApp();
    const admin = await app.seedAdmin();
    await createAcademicYear(app.as(admin), year2026);
    const teacher: Actor = { role: "teacher", userId: "some-teacher" };

    await expect(createAcademicYear(app.as(teacher), year2026)).rejects.toThrow(AccessDenied);
    await expect(updateAcademicYear(app.as(teacher), { id: 1, ...year2026 })).rejects.toThrow(AccessDenied);
    expect(await termOn(app.as(teacher), "2026-10-01")).toMatchObject({ name: "Term 1" });
  });
});

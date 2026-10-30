import { describe, expect, it } from "vitest";
import { testApp } from "../../../test/test-app";
import type { Actor } from "../context";
import { AccessDenied } from "../errors";
import { createAcademicYear } from "./academic-year";
import { createGrade, createRoom, createSubject } from "./catalogue";
import { setPeriodsPerDay } from "./periods";
import { getSchoolSetup } from "./school-setup";

describe("School setup overview", () => {
  it("shows the Admin every Academic Year with its Terms in order, the Grades, Subjects, Rooms and Periods per day", async () => {
    const app = await testApp();
    const admin = await app.seedAdmin();
    await createAcademicYear(app.as(admin), {
      name: "2026-2027",
      startDate: "2026-09-01",
      endDate: "2027-06-30",
      terms: [
        { name: "Term 2", startDate: "2027-01-01", endDate: "2027-06-30" },
        { name: "Term 1", startDate: "2026-09-01", endDate: "2026-12-31" },
      ],
    });
    await createGrade(app.as(admin), { name: "Grade 7" });
    await createSubject(app.as(admin), { name: "Math" });
    await createRoom(app.as(admin), { name: "Hall A" });
    await setPeriodsPerDay(app.as(admin), 7);

    const setup = await getSchoolSetup(app.as(admin));

    expect(setup).toMatchObject({
      academicYears: [
        {
          name: "2026-2027",
          startDate: "2026-09-01",
          endDate: "2027-06-30",
          terms: [
            { name: "Term 1", startDate: "2026-09-01", endDate: "2026-12-31" },
            { name: "Term 2", startDate: "2027-01-01", endDate: "2027-06-30" },
          ],
        },
      ],
      grades: [{ name: "Grade 7" }],
      subjects: [{ name: "Math" }],
      rooms: [{ name: "Hall A" }],
      periodsPerDay: 7,
    });
  });

  it("is refused to a Teacher", async () => {
    const app = await testApp();
    const teacher: Actor = { role: "teacher", userId: "some-teacher" };

    await expect(getSchoolSetup(app.as(teacher))).rejects.toThrow(AccessDenied);
  });
});

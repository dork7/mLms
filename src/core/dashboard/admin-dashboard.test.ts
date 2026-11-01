import { describe, expect, it } from "vitest";
import { testApp } from "../../../test/test-app";
import { disableLogin } from "../accounts/disable-login";
import { assessmentSchool } from "../assessments/test-assessments";
import { createClass } from "../classes/classes";
import type { Actor } from "../context";
import { moveStudent } from "../enrollment/enrollment";
import { AccessDenied } from "../errors";
import { publishReportCards, unpublishReportCards } from "../report-cards/publish";
import { createAcademicYear } from "../school/academic-year";
import { registerStudent } from "../students/register-student";
import { closeAcademicYear, promoteClass } from "../year-end/year-end";
import { getAdminDashboard } from "./admin-dashboard";

const nextYear = {
  name: "2027-2028",
  startDate: "2027-09-01",
  endDate: "2028-06-30",
  terms: [{ name: "Term 1", startDate: "2027-09-01", endDate: "2028-06-30" }],
};

describe("Admin dashboard", () => {
  it("shows the Admin their name and today's date from the Clock", async () => {
    const app = await testApp({ now: "2026-09-01T08:00:00+04:00" });
    const admin = await app.seedAdmin("Amina Office");

    const dashboard = await getAdminDashboard(app.as(admin));

    expect(dashboard).toMatchObject({ adminName: "Amina Office", today: "2026-09-01" });
  });

  it("has nothing to count in a new school", async () => {
    const app = await testApp({ now: "2026-09-01T08:00:00+04:00" });
    const admin = await app.seedAdmin();

    const dashboard = await getAdminDashboard(app.as(admin));

    expect(dashboard).toMatchObject({
      students: 0,
      teachers: 0,
      classes: 0,
      academicYear: null,
      reportCardsWaiting: [],
    });
  });

  it("is refused to a Teacher", async () => {
    const app = await testApp();
    const teacher: Actor = { role: "teacher", userId: "some-teacher" };

    await expect(getAdminDashboard(app.as(teacher))).rejects.toThrow(AccessDenied);
  });

  it("is refused to a Student", async () => {
    const app = await testApp();

    await expect(getAdminDashboard(app.as({ role: "student", userId: "some-student" }))).rejects.toThrow(AccessDenied);
  });
});

describe("the counts on the Admin dashboard", () => {
  it("counts the Students enrolled, not those registered but in no Class", async () => {
    const s = await assessmentSchool();
    await registerStudent(s.asAdmin, {
      name: "Chadi Waiting",
      studentNumber: "S-3",
      dateOfBirth: "2013-04-12",
      nationalId: "784-S-3",
      guardianContact: "Guardian",
      admissionDate: "2026-08-25",
    });

    expect((await getAdminDashboard(s.asAdmin)).students).toBe(2);
  });

  it("counts a Student who moved Class once", async () => {
    const s = await assessmentSchool();
    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-10-01" });

    expect((await getAdminDashboard(s.asAdmin)).students).toBe(2);
  });

  it("stops counting a Student after their last day", async () => {
    const s = await assessmentSchool();
    await createAcademicYear(s.asAdmin, nextYear);
    await promoteClass(s.asAdmin, {
      classId: s.class7A.id,
      leaving: [{ studentId: s.aisha, lastDay: "2026-11-30" }, { studentId: s.bilal }],
    });

    s.app.clock.set("2026-11-30T08:00:00+04:00");
    expect((await getAdminDashboard(s.asAdmin)).students).toBe(2);
    s.app.clock.set("2026-12-01T08:00:00+04:00");
    expect((await getAdminDashboard(s.asAdmin)).students).toBe(1);
  });

  it("counts the Teachers whose login isn't disabled", async () => {
    const s = await assessmentSchool();
    expect((await getAdminDashboard(s.asAdmin)).teachers).toBe(3);

    await disableLogin(s.asAdmin, { userId: s.omar.userId });

    expect((await getAdminDashboard(s.asAdmin)).teachers).toBe(2);
  });

  it("counts the Classes of the Academic Year today falls in, not of other years", async () => {
    const s = await assessmentSchool();
    const later = await createAcademicYear(s.asAdmin, nextYear);
    await createClass(s.asAdmin, {
      academicYearId: later.id,
      gradeId: s.grade7.id,
      name: "7-Next",
      classTeacherId: s.omar.userId,
    });

    expect(await getAdminDashboard(s.asAdmin)).toMatchObject({ classes: 2, academicYear: "2026-2027" });
  });

  it("counts the newest Academic Year's Classes between two years", async () => {
    const s = await assessmentSchool();
    const later = await createAcademicYear(s.asAdmin, nextYear);
    await createClass(s.asAdmin, {
      academicYearId: later.id,
      gradeId: s.grade7.id,
      name: "7-Next",
      classTeacherId: s.omar.userId,
    });

    s.app.clock.set("2027-08-01T08:00:00+04:00");

    expect(await getAdminDashboard(s.asAdmin)).toMatchObject({ classes: 1, academicYear: "2027-2028" });
  });
});

describe("Report Cards waiting to be Published", () => {
  /** Aisha and Bilal in 7-A. Today 2026-10-20; Term 1 ends 2026-12-31 and Term 2 ends 2027-06-30. */
  async function waitingSchool() {
    const s = await assessmentSchool();
    const waiting = async () => (await getAdminDashboard(s.asAdmin)).reportCardsWaiting;
    const term1Ended = () => s.app.clock.set("2027-01-05T08:00:00+04:00");
    return { ...s, waiting, term1Ended };
  }

  it("has none before a Term's last day, though the Class will issue them", async () => {
    const s = await waitingSchool();
    s.app.clock.set("2026-12-30T08:00:00+04:00");

    expect(await s.waiting()).toEqual([]);
  });

  it("lists a Class and Term with how many Report Cards, from the Term's last day", async () => {
    const s = await waitingSchool();
    s.app.clock.set("2026-12-31T08:00:00+04:00");

    expect(await s.waiting()).toEqual([
      {
        classId: s.class7A.id,
        class: "7-A",
        termId: expect.any(Number),
        term: "Term 1",
        academicYear: "2026-2027",
        reportCards: 2,
      },
    ]);
  });

  it("counts a moved Student only on their Issuing Class, and leaves out a Class issuing none", async () => {
    const s = await waitingSchool();
    await moveStudent(s.asAdmin, { studentId: s.aisha, classId: s.class7B.id, date: "2026-11-01" });
    await moveStudent(s.asAdmin, { studentId: s.bilal, classId: s.class7B.id, date: "2026-11-01" });
    s.term1Ended();

    expect((await s.waiting()).map((w) => [w.class, w.reportCards])).toEqual([["7-B", 2]]);
  });

  it("doesn't wait for a Student with no Issuing Class", async () => {
    const s = await waitingSchool();
    await createAcademicYear(s.asAdmin, nextYear);
    await promoteClass(s.asAdmin, {
      classId: s.class7A.id,
      leaving: [{ studentId: s.aisha, lastDay: "2026-11-30" }, { studentId: s.bilal }],
    });
    s.term1Ended();

    expect((await s.waiting()).map((w) => [w.class, w.reportCards])).toEqual([["7-A", 1]]);
  });

  it("drops a Class and Term once Published, and brings it back when unpublished", async () => {
    const s = await waitingSchool();
    s.term1Ended();
    const [{ classId, termId }] = await s.waiting();

    await publishReportCards(s.asAdmin, { classId, termId });
    expect(await s.waiting()).toEqual([]);

    await unpublishReportCards(s.asAdmin, { classId, termId });
    expect((await s.waiting()).map((w) => w.reportCards)).toEqual([2]);
  });

  it("keeps a Term waiting when only another Term of the Class is Published", async () => {
    const s = await waitingSchool();
    s.term1Ended();
    const [{ classId, termId }] = await s.waiting();
    await publishReportCards(s.asAdmin, { classId, termId });

    s.app.clock.set("2027-06-30T08:00:00+04:00");

    expect((await s.waiting()).map((w) => w.term)).toEqual(["Term 2"]);
  });

  it("leaves out a Closed year, whose Report Cards can no longer be Published", async () => {
    const s = await waitingSchool();
    s.term1Ended();
    await createAcademicYear(s.asAdmin, nextYear);
    await promoteClass(s.asAdmin, {
      classId: s.class7A.id,
      leaving: [{ studentId: s.aisha }, { studentId: s.bilal }],
    });
    expect(await s.waiting()).not.toEqual([]);

    await closeAcademicYear(s.asAdmin, { academicYearId: s.year.id });

    expect(await s.waiting()).toEqual([]);
  });
});

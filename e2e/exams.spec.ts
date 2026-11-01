import { expect, test, type Page } from "@playwright/test";

// Names and dates here are unique to this spec: e2e specs share one database and run
// in parallel. The year (2061-2062) is far in the future so it overlaps no other
// spec's year. The project runs at phone width (Pixel 7).
async function logIn(page: Page, identifier: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email, phone or Student Number").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

// A controlled <select> chosen before React hydrates is reset by hydration, and its
// `required` then silently blocks the submit. Under a cold `next dev` that window is wide,
// so wait for the page to settle before touching a form.
async function settled(page: Page) {
  await page.waitForLoadState("networkidle");
}

async function open(page: Page, path: string) {
  await page.goto(path);
  await settled(page);
}

async function addNamed(page: Page, path: string, label: string, name: string) {
  await open(page, path);
  await page.getByLabel(label).first().fill(name);
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.locator(`input[name="name"][value="${name}"]`)).toBeVisible();
}

async function addClassWithSubject(page: Page, className: string) {
  await open(page, "/admin/classes");
  await page.getByRole("combobox", { name: "Academic Year" }).selectOption({ label: "2061-2062" });
  await page.getByRole("combobox", { name: "Grade", exact: true }).selectOption({ label: "Grade 12" });
  await page.getByLabel("Class name").fill(className);
  await page.getByRole("combobox", { name: "Class Teacher" }).selectOption({ label: "Noura Exams" });
  await page.getByRole("button", { name: "Add Class" }).click();
  await page.getByRole("link", { name: className }).click();
  await expect(page.getByRole("heading", { name: className })).toBeVisible();
  await settled(page);
  await page.getByRole("combobox", { name: "Subject", exact: true }).selectOption({ label: "Astronomy" });
  await page.getByRole("combobox", { name: "Subject Teacher", exact: true }).selectOption({ label: "Noura Exams" });
  await page.getByRole("button", { name: "Add Class Subject" }).click();
  await expect(page.getByRole("combobox", { name: "Subject Teacher of Astronomy" })).toHaveValue(/.+/);
}

async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test("the Admin builds a Term's exam timetable, and the Subject Teacher enters Exam Marks", async ({ page }) => {
  await logIn(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!);
  await expect(page).toHaveURL(/\/admin$/);

  await open(page, "/admin/academic-years");
  await page.getByLabel("Academic Year name").fill("2061-2062");
  await page.getByLabel("First day", { exact: true }).fill("2061-09-01");
  await page.getByLabel("Last day", { exact: true }).fill("2062-06-30");
  await page.getByLabel("Term 1 name").fill("Exam year");
  await page.getByLabel("Term 1 first day").fill("2061-09-01");
  await page.getByLabel("Term 1 last day").fill("2062-06-30");
  await page.getByRole("button", { name: "Create Academic Year" }).click();
  await expect(page.getByRole("heading", { name: /2061-2062/ })).toBeVisible();

  await addNamed(page, "/admin/grades", "Grade name", "Grade 12");
  await addNamed(page, "/admin/subjects", "Subject name", "Astronomy");
  await addNamed(page, "/admin/rooms", "Room name", "Exam Hall");
  await addNamed(page, "/admin/rooms", "Room name", "Exam Lab");

  await open(page, "/admin/teachers");
  await page.getByLabel("Name").fill("Noura Exams");
  await page.getByLabel("Email").fill("noura.exams@school.test");
  await page.getByRole("button", { name: "Add Teacher" }).click();
  const nouraPassword = (await page.getByRole("status").locator("code").textContent())!;

  await addClassWithSubject(page, "12-X");
  await addClassWithSubject(page, "12-Y");

  await open(page, "/admin/students");
  await page.getByLabel("Name").fill("Jamal Exams");
  await page.getByLabel("Student Number").fill("E2E-1301");
  await page.getByLabel("Date of birth").fill("2049-03-03");
  await page.getByLabel("National ID").fill("784-E2E-1301");
  await page.getByLabel("Guardian contact").fill("Guardian");
  await page.getByLabel("Admission date").fill("2061-08-25");
  await page.getByRole("button", { name: "Register Student" }).click();
  await expect(page.getByRole("status").filter({ hasText: "E2E-1301" })).toBeVisible();
  await page.getByRole("listitem").filter({ hasText: "Jamal Exams" }).getByRole("link", { name: "Profile" }).click();
  await expect(page.getByRole("combobox", { name: "Class" })).toBeVisible();
  await settled(page);
  await page.getByRole("combobox", { name: "Class" }).selectOption({ label: "12-X (Grade 12, 2061-2062)" });
  await page.getByLabel("From").fill("2061-09-01");
  await page.getByRole("button", { name: "Enroll" }).click();
  await expect(page.getByText("From 2061-09-01 · Current")).toBeVisible();

  // The Admin opens the timetable from the dashboard and picks the Term.
  await page.goto("/admin");
  await page.getByRole("link", { name: "Exam timetable" }).click();
  await page.getByRole("combobox", { name: "Term", exact: true }).selectOption({ label: "2061-2062: Exam year" });
  await page.getByRole("button", { name: "Show" }).click();
  await expect(page.getByRole("heading", { name: "Exams in Exam year (2061-2062)" })).toBeVisible();
  await settled(page);
  const timetable = page.getByRole("region", { name: "Exams in Exam year (2061-2062)" });
  await expect(timetable.getByText("No Exams in this Term yet.")).toBeVisible();

  const add = page.getByRole("region", { name: "Add an Exam" });
  const classSubject = add.getByRole("combobox", { name: "Class Subject" });
  const room = add.getByRole("combobox", { name: "Room" });
  await classSubject.selectOption({ label: "Astronomy for 12-X" });
  await room.selectOption({ label: "Exam Hall" });
  await add.getByRole("combobox", { name: "Type" }).selectOption({ label: "Final" });
  await add.getByLabel("Date").fill("2061-11-10");
  await add.getByLabel("Start time").fill("09:00");
  await add.getByLabel("Duration (minutes)").fill("90");
  await add.getByLabel("Maximum marks").fill("100");
  await add.getByLabel("Weight").fill("3");
  await add.getByRole("button", { name: "Add Exam" }).click();
  await expect(add.getByRole("status").filter({ hasText: "Exam added." })).toBeVisible();

  const finalGroup = timetable.getByRole("region", { name: "Grade 12 Astronomy, Final, 2061-11-10, 09:00 to 10:30" });
  await expect(finalGroup.getByRole("listitem")).toHaveCount(1);
  await expect(finalGroup.getByText("12-X in Exam Hall (Noura Exams)")).toBeVisible();

  // The time is kept for the next Class of a grade-wide Exam; the same Room is refused.
  await classSubject.selectOption({ label: "Astronomy for 12-Y" });
  await room.selectOption({ label: "Exam Hall" });
  await add.getByRole("button", { name: "Add Exam" }).click();
  await expect(add.getByRole("alert").filter({ hasText: "This Room already has an Exam" })).toBeVisible();
  await expect(add.getByLabel("Start time")).toHaveValue("09:00");

  // Another Room is accepted, and the two Classes show as one grade-wide Exam.
  await room.selectOption({ label: "Exam Lab" });
  await add.getByRole("button", { name: "Add Exam" }).click();
  await expect(finalGroup.getByRole("listitem")).toHaveCount(2);
  await expect(finalGroup.getByText("12-Y in Exam Lab (Noura Exams)")).toBeVisible();
  await expectNoSidewaysScroll(page);

  // The same Class at an overlapping time is refused, though the Room is free.
  await classSubject.selectOption({ label: "Astronomy for 12-X" });
  await room.selectOption({ label: "Exam Lab" });
  await add.getByLabel("Start time").fill("10:00");
  await add.getByRole("button", { name: "Add Exam" }).click();
  await expect(add.getByRole("alert").filter({ hasText: "This Class already has an Exam" })).toBeVisible();

  // A refusal keeps the choices, so only the time needs changing. Back-to-back in the same Room is allowed.
  await expect(classSubject).not.toHaveValue("");
  await expect(room).not.toHaveValue("");
  await add.getByLabel("Start time").fill("10:30");
  await add.getByRole("button", { name: "Add Exam" }).click();
  await expect(
    timetable.getByRole("region", { name: "Grade 12 Astronomy, Final, 2061-11-10, 10:30 to 12:00" }),
  ).toBeVisible();

  // A grade-wide Exam: one Room per Class. A clash refuses the whole add and keeps what was typed.
  const gradeWide = page.getByRole("region", { name: "Add a grade-wide Exam" });
  await gradeWide.getByRole("combobox", { name: "Grade and Subject" }).selectOption({ label: "Grade 12 Astronomy" });
  await gradeWide.getByRole("combobox", { name: "Room for 12-X" }).selectOption({ label: "Exam Hall" });
  await gradeWide.getByRole("combobox", { name: "Room for 12-Y" }).selectOption({ label: "Exam Hall" });
  await gradeWide.getByRole("combobox", { name: "Type" }).selectOption({ label: "Midterm" });
  await gradeWide.getByLabel("Date").fill("2061-12-01");
  await gradeWide.getByLabel("Start time").fill("09:00");
  await gradeWide.getByLabel("Duration (minutes)").fill("60");
  await gradeWide.getByLabel("Maximum marks").fill("50");
  await gradeWide.getByLabel("Weight").fill("2");
  await gradeWide.getByRole("button", { name: "Add grade-wide Exam" }).click();
  await expect(gradeWide.getByRole("alert").filter({ hasText: "This Room already has an Exam" })).toBeVisible();
  await expect(timetable.getByRole("region", { name: /Midterm/ })).toHaveCount(0);

  await gradeWide.getByRole("combobox", { name: "Room for 12-Y" }).selectOption({ label: "Exam Lab" });
  await gradeWide.getByRole("button", { name: "Add grade-wide Exam" }).click();
  await expect(gradeWide.getByRole("status").filter({ hasText: "Grade-wide Exam added." })).toBeVisible();
  const midterm = timetable.getByRole("region", { name: "Grade 12 Astronomy, Midterm, 2061-12-01, 09:00 to 10:00" });
  await expect(midterm.getByText("12-X in Exam Hall (Noura Exams)")).toBeVisible();
  await expect(midterm.getByText("12-Y in Exam Lab (Noura Exams)")).toBeVisible();
  await expectNoSidewaysScroll(page);

  // The Subject Teacher finds the Exam's Assessment in the normal list and enters a Mark.
  await page.context().clearCookies();
  await logIn(page, "noura.exams@school.test", nouraPassword);
  await page.getByLabel("Current password").fill(nouraPassword);
  await page.getByLabel("New password", { exact: true }).fill("noura's own password");
  await page.getByLabel("Confirm new password").fill("noura's own password");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page).toHaveURL(/\/teacher$/);
  await page.getByRole("region", { name: "My Class Subjects" }).getByRole("link", { name: "Astronomy for 12-X" }).click();
  await page.getByRole("region", { name: "Assessments" }).getByRole("link", { name: "Final, 2061-11-10" }).first().click();
  await expect(page.getByRole("heading", { name: "Final on 2061-11-10" })).toBeVisible();

  const grid = page.getByRole("region", { name: "Marks", exact: true });
  await grid.getByLabel("Mark for Jamal Exams").fill("87");
  await grid.getByRole("button", { name: "Save Marks" }).click();
  await expect(grid.getByRole("status").filter({ hasText: "Marks saved." })).toBeVisible();
  await expectNoSidewaysScroll(page);
});

import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Names and dates here are unique to this spec: e2e specs share one database and run in
// parallel. The dev server uses the real clock, so the Student's current Class comes from an
// open Enrollment: it began in this past year (2005-2006) and still covers today. The project
// runs at phone width (Pixel 7).
const PASSWORD = "a password of my own";

async function logIn(page: Page, identifier: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email, phone or Student Number").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

async function logInFirstTime(page: Page, identifier: string, initialPassword: string, home: RegExp) {
  await page.context().clearCookies();
  await logIn(page, identifier, initialPassword);
  await page.getByLabel("Current password").fill(initialPassword);
  await page.getByLabel("New password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm new password").fill(PASSWORD);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page).toHaveURL(home);
}

// A controlled <select> chosen before React hydrates is reset by hydration: wait first.
async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

async function addNamed(page: Page, path: string, label: string, name: string) {
  await open(page, path);
  await page.getByLabel(label).first().fill(name);
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.locator(`input[name="name"][value="${name}"]`)).toBeVisible();
}

async function addTeacher(page: Page, name: string, email: string): Promise<string> {
  await open(page, "/admin/teachers");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Add Teacher" }).click();
  return (await page.getByRole("status").filter({ hasText: name }).locator("code").textContent())!;
}

async function addClassWithSubject(page: Page, className: string, teacher: string) {
  await open(page, "/admin/classes");
  await page.getByRole("combobox", { name: "Academic Year" }).selectOption({ label: "2005-2006" });
  await page.getByRole("combobox", { name: "Grade", exact: true }).selectOption({ label: "Grade Schedule" });
  await page.getByLabel("Class name").fill(className);
  await page.getByRole("combobox", { name: "Class Teacher" }).selectOption({ label: teacher });
  await page.getByRole("button", { name: "Add Class" }).click();
  await page.getByRole("link", { name: className }).click();
  await expect(page.getByRole("heading", { name: className })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.getByRole("combobox", { name: "Subject", exact: true }).selectOption({ label: "Geology" });
  await page.getByRole("combobox", { name: "Subject Teacher", exact: true }).selectOption({ label: teacher });
  await page.getByRole("button", { name: "Add Class Subject" }).click();
  await expect(page.getByRole("combobox", { name: "Subject Teacher of Geology" })).toHaveValue(/.+/);
}

async function addExam(page: Page, className: string, room: string) {
  const add = page.getByRole("region", { name: "Add an Exam" });
  await add.getByRole("combobox", { name: "Class Subject" }).selectOption({ label: `Geology for ${className}` });
  await add.getByRole("combobox", { name: "Room" }).selectOption({ label: room });
  await add.getByRole("combobox", { name: "Type" }).selectOption({ label: "Final" });
  await add.getByLabel("Date").fill("2005-11-10");
  await add.getByLabel("Start time").fill("09:00");
  await add.getByLabel("Duration (minutes)").fill("90");
  await add.getByLabel("Maximum marks").fill("100");
  await add.getByLabel("Weight").fill("3");
  await add.getByRole("button", { name: "Add Exam" }).click();
  await expect(page.getByText(`${className} in ${room}`)).toBeVisible();
}

async function downloadCalendar(page: Page) {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Add to calendar (.ics)" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("exam-schedule.ics");
  return readFileSync(await download.path(), "utf8");
}

async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test("Students and Teachers see, print and export only their own Exams", async ({ page }) => {
  await logIn(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!);
  await expect(page).toHaveURL(/\/admin$/);

  await open(page, "/admin/academic-years");
  await page.getByLabel("Academic Year name").fill("2005-2006");
  await page.getByLabel("First day", { exact: true }).fill("2005-09-01");
  await page.getByLabel("Last day", { exact: true }).fill("2006-06-30");
  await page.getByLabel("Term 1 name").fill("Schedule year");
  await page.getByLabel("Term 1 first day").fill("2005-09-01");
  await page.getByLabel("Term 1 last day").fill("2006-06-30");
  await page.getByRole("button", { name: "Create Academic Year" }).click();
  await expect(page.getByRole("heading", { name: /2005-2006/ })).toBeVisible();

  await addNamed(page, "/admin/grades", "Grade name", "Grade Schedule");
  await addNamed(page, "/admin/subjects", "Subject name", "Geology");
  await addNamed(page, "/admin/rooms", "Room name", "Schedule Hall");
  await addNamed(page, "/admin/rooms", "Room name", "Schedule Lab");
  const laylaPassword = await addTeacher(page, "Layla Schedule", "layla.schedule@school.test");
  await addTeacher(page, "Tariq Schedule", "tariq.schedule@school.test");
  await addClassWithSubject(page, "Sched-1", "Layla Schedule");
  await addClassWithSubject(page, "Sched-2", "Tariq Schedule");

  await open(page, "/admin/students");
  await page.getByLabel("Name").fill("Mona Schedule");
  await page.getByLabel("Student Number").fill("E2E-1401");
  await page.getByLabel("Date of birth").fill("1993-03-03");
  await page.getByLabel("National ID").fill("784-E2E-1401");
  await page.getByLabel("Guardian contact").fill("Guardian");
  await page.getByLabel("Admission date").fill("2005-08-25");
  await page.getByRole("button", { name: "Register Student" }).click();
  const status = page.getByRole("status").filter({ hasText: "E2E-1401" });
  await expect(status).toBeVisible();
  const monaPassword = (await status.locator("code").textContent())!;
  await page.getByRole("listitem").filter({ hasText: "Mona Schedule" }).getByRole("link", { name: "Profile" }).click();
  await expect(page.getByRole("combobox", { name: "Class" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.getByRole("combobox", { name: "Class" }).selectOption({ label: "Sched-1 (Grade Schedule, 2005-2006)" });
  await page.getByLabel("From").fill("2005-09-01");
  await page.getByRole("button", { name: "Enroll" }).click();
  await expect(page.getByText("From 2005-09-01 · Current")).toBeVisible();

  await open(page, "/admin/exams");
  await page.getByRole("combobox", { name: "Term", exact: true }).selectOption({ label: "2005-2006: Schedule year" });
  await page.getByRole("button", { name: "Show" }).click();
  await expect(page.getByRole("heading", { name: "Exams in Schedule year (2005-2006)" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await addExam(page, "Sched-1", "Schedule Hall");
  await addExam(page, "Sched-2", "Schedule Lab");

  // The Student reaches their schedule from their landing page, and sees only their Class's Exam.
  await logInFirstTime(page, "E2E-1401", monaPassword, /\/student$/);
  await expectNoSidewaysScroll(page);
  await page.getByRole("link", { name: "My Exams" }).click();
  await expect(page.getByRole("heading", { name: "My Exams" })).toBeVisible();
  const monaSchedule = page.getByRole("region", { name: "Mona Schedule" });
  await expect(monaSchedule.getByRole("listitem")).toHaveCount(1);
  await expect(monaSchedule.getByText("Geology, Final, Sched-1")).toBeVisible();
  await expect(monaSchedule.getByText("2005-11-10, 09:00 to 10:30")).toBeVisible();
  await expect(monaSchedule.getByText("Room: Schedule Hall")).toBeVisible();
  await expectNoSidewaysScroll(page);

  // The Print button prints; on paper only the schedule itself is left.
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => {
    window.print = () => document.body.setAttribute("data-printed", "yes");
  });
  await page.getByRole("button", { name: "Print" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-printed", "yes");
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("button", { name: "Print" })).toBeHidden();
  await expect(page.getByRole("link", { name: "Dashboard" })).toBeHidden();
  await expect(page.getByRole("link", { name: "Add to calendar (.ics)" })).toBeHidden();
  await expect(monaSchedule.getByText("Geology, Final, Sched-1")).toBeVisible();
  await page.emulateMedia({ media: "screen" });

  // The calendar file holds the Student's Exam alone.
  const monaCalendar = await downloadCalendar(page);
  expect(monaCalendar).toContain("SUMMARY:Geology Final (Sched-1)");
  expect(monaCalendar).toContain("LOCATION:Schedule Hall");
  expect(monaCalendar).not.toContain("Sched-2");

  // So does the Teacher's, for the Class Subject they teach.
  await logInFirstTime(page, "layla.schedule@school.test", laylaPassword, /\/teacher$/);
  await expectNoSidewaysScroll(page);
  await page.getByRole("link", { name: "My Exams" }).click();
  const laylaSchedule = page.getByRole("region", { name: "Layla Schedule" });
  await expect(laylaSchedule.getByRole("listitem")).toHaveCount(1);
  await expect(laylaSchedule.getByText("Geology, Final, Sched-1")).toBeVisible();
  const laylaCalendar = await downloadCalendar(page);
  expect(laylaCalendar).toContain("SUMMARY:Geology Final (Sched-1)");
  expect(laylaCalendar).not.toContain("Sched-2");

  // Once the Student moves Class, the old Class's Exam is a past Exam: shown apart and read-only.
  await page.context().clearCookies();
  await logIn(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!);
  await expect(page).toHaveURL(/\/admin$/);
  await open(page, "/admin/students");
  await page.getByRole("listitem").filter({ hasText: "Mona Schedule" }).getByRole("link", { name: "Profile" }).click();
  await expect(page.getByRole("button", { name: "Move" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.getByRole("combobox", { name: "Class" }).selectOption({ label: "Sched-2 (Grade Schedule, 2005-2006)" });
  await page.getByLabel("From").fill("2006-01-01");
  await page.getByRole("button", { name: "Move" }).click();
  await expect(page.getByText("From 2006-01-01 · Current")).toBeVisible();

  await page.context().clearCookies();
  await logIn(page, "E2E-1401", PASSWORD);
  await expect(page).toHaveURL(/\/student$/);
  await page.getByRole("link", { name: "My Exams" }).click();
  await expect(monaSchedule.getByText("Geology, Final, Sched-2")).toBeVisible();
  await expect(monaSchedule.getByRole("listitem")).toHaveCount(1);
  const past = page.getByRole("region", { name: "Past Exams" });
  await expect(past.getByText("Geology, Final, Sched-1")).toBeVisible();
  await expect(past.getByText("Room: Schedule Hall")).toBeVisible();
  await expect(past.getByRole("link")).toHaveCount(0);
  await expect(past.getByRole("button")).toHaveCount(0);
  await expectNoSidewaysScroll(page);
  await page.emulateMedia({ media: "print" });
  await expect(past).toBeHidden();
  await page.emulateMedia({ media: "screen" });
  const movedCalendar = await downloadCalendar(page);
  expect(movedCalendar).toContain("SUMMARY:Geology Final (Sched-2)");
  expect(movedCalendar).not.toContain("Sched-1");
});

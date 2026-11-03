import { expect, test, type Page } from "@playwright/test";

// Names and dates here are unique to this spec: e2e specs share one database and run in
// parallel. The dev server uses the real clock, and a Student's Class Teacher is the one of
// the Class they're enrolled in today, so the Student has an open Enrollment that began in
// this past year (2009-2010) and still covers today. Absent becoming Exempt is tested at the
// layer; here the Student has no Marks, so the decision reports none changed.
const PASSWORD = "a password of my own";
const TEACHER = "noura.leave@school.test";
const STUDENT_NUMBER = "LV-2201";

async function logIn(page: Page, identifier: string, password: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email, phone or Student Number").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

async function logInFirstTime(page: Page, identifier: string, initialPassword: string, home: RegExp) {
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

async function follow(page: Page, link: string) {
  await page.getByRole("link", { name: link }).click();
  await page.waitForLoadState("networkidle");
}

test("a Student requests leave, their Class Teacher approves it, and the Student sees it approved", async ({
  page,
}) => {
  await logIn(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!);
  await expect(page).toHaveURL(/\/admin$/);

  await open(page, "/admin/academic-years");
  await page.getByLabel("Academic Year name").fill("2009-2010");
  await page.getByLabel("First day", { exact: true }).fill("2009-09-01");
  await page.getByLabel("Last day", { exact: true }).fill("2010-06-30");
  await page.getByLabel("Term 1 name").fill("Leave year");
  await page.getByLabel("Term 1 first day").fill("2009-09-01");
  await page.getByLabel("Term 1 last day").fill("2010-06-30");
  await page.getByRole("button", { name: "Create Academic Year" }).click();
  await expect(page.getByRole("heading", { name: /2009-2010/ })).toBeVisible();

  await open(page, "/admin/grades");
  await page.getByLabel("Grade name").first().fill("Grade 44");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.locator('input[name="name"][value="Grade 44"]')).toBeVisible();

  await open(page, "/admin/teachers");
  await page.getByLabel("Name").fill("Noura Leave");
  await page.getByLabel("Email").fill(TEACHER);
  await page.getByRole("button", { name: "Add Teacher" }).click();
  const nouraPassword = (await page.getByRole("status").filter({ hasText: "Noura Leave" }).locator("code").textContent())!;

  await open(page, "/admin/classes");
  await page.getByRole("combobox", { name: "Academic Year" }).selectOption({ label: "2009-2010" });
  await page.getByRole("combobox", { name: "Grade", exact: true }).selectOption({ label: "Grade 44" });
  await page.getByLabel("Class name").fill("44-L");
  await page.getByRole("combobox", { name: "Class Teacher" }).selectOption({ label: "Noura Leave" });
  await page.getByRole("button", { name: "Add Class" }).click();
  await expect(page.getByRole("link", { name: "44-L" })).toBeVisible();

  await open(page, "/admin/students");
  await page.getByLabel("Name").fill("Salem Leave");
  await page.getByLabel("Student Number").fill(STUDENT_NUMBER);
  await page.getByLabel("Date of birth").fill("1997-05-05");
  await page.getByLabel("National ID").fill(`784-${STUDENT_NUMBER}`);
  await page.getByLabel("Guardian contact").fill("Guardian");
  await page.getByLabel("Admission date").fill("2009-08-25");
  await page.getByRole("button", { name: "Register Student" }).click();
  const status = page.getByRole("status").filter({ hasText: STUDENT_NUMBER });
  await expect(status).toBeVisible();
  const salemPassword = (await status.locator("code").textContent())!;
  await page.getByRole("listitem").filter({ hasText: "Salem Leave" }).getByRole("link", { name: "Profile" }).click();
  await expect(page.getByRole("combobox", { name: "Class" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.getByRole("combobox", { name: "Class" }).selectOption({ label: "44-L (Grade 44, 2009-2010)" });
  await page.getByLabel("From").fill("2009-09-01");
  await page.getByRole("button", { name: "Enroll" }).click();
  await expect(page.getByText("From 2009-09-01 · Current")).toBeVisible();

  // Salem requests leave from his phone.
  await logInFirstTime(page, STUDENT_NUMBER, salemPassword, /\/student$/);
  await follow(page, "My Leave");
  await expect(page.getByRole("heading", { name: "My Leave Requests" })).toBeVisible();
  const form = page.getByRole("region", { name: "Request leave" });
  await form.getByLabel("First day").fill("2032-04-11");
  await form.getByLabel("Last day").fill("2032-04-13");
  await form.getByLabel("Reason").fill("Fever, with a doctor's note");
  await form.getByRole("button", { name: "Submit request" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Your Leave Request was sent to your Class Teacher." }),
  ).toBeVisible();
  const mine = page.getByRole("region", { name: "Your requests" }).getByRole("listitem", { name: "2032-04-11 to 2032-04-13" });
  await expect(mine).toContainText("Pending");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  // Noura, his Class Teacher, approves it.
  await logInFirstTime(page, TEACHER, nouraPassword, /\/teacher$/);
  await follow(page, "Student Leave Requests");
  const waiting = page
    .getByRole("region", { name: "Waiting for a decision" })
    .getByRole("listitem", { name: "Salem Leave: 2032-04-11 to 2032-04-13" });
  await expect(waiting).toContainText("44-L");
  await expect(waiting).toContainText("Fever, with a doctor's note");
  await waiting.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Approved. Absent Marks made Exempt: 0." })).toBeVisible();
  const decided = page
    .getByRole("region", { name: "Decided" })
    .getByRole("listitem", { name: "Salem Leave: 2032-04-11 to 2032-04-13" });
  await expect(decided).toContainText("Approved by Noura Leave");
  await expect(waiting).toHaveCount(0);

  // Salem sees it approved.
  await logIn(page, STUDENT_NUMBER, PASSWORD);
  await expect(page).toHaveURL(/\/student$/);
  await follow(page, "My Leave");
  await expect(mine).toContainText("Approved by Noura Leave");
});

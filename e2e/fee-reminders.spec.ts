import { expect, test, type Page } from "@playwright/test";

// Names and numbers here are unique to this spec: e2e specs share one database and run in
// parallel. This spec owns the Students REM-2101 and REM-2102 ("... Reminders") and the Fee
// "Reminders Spec Trip". It changes the school-wide Fee Reminder timings and puts them back
// to 7 and 7: no other spec may depend on them. The dev server's Mailer logs to the console.

async function logInAsAdmin(page: Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email, phone or Student Number").fill(process.env.E2E_ADMIN_EMAIL!);
  await page.getByLabel("Password").fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

// A controlled input changed before React hydrates is reset by hydration: wait first.
async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

async function register(page: Page, name: string, studentNumber: string, email: string) {
  await open(page, "/admin/students");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Student Number").fill(studentNumber);
  await page.getByLabel("Date of birth").fill("2012-03-03");
  await page.getByLabel("National ID").fill(`784-${studentNumber}`);
  await page.getByLabel("Guardian contact").fill(`Guardian of ${name}, +971 50 210 0000`);
  await page.getByLabel("Email (optional)").fill(email);
  await page.getByLabel("Admission date").fill("2026-08-25");
  await page.getByRole("button", { name: "Register Student" }).click();
  await expect(page.getByRole("status").filter({ hasText: studentNumber })).toBeVisible();
}

async function saveTimings(page: Page, lead: string, interval: string) {
  const reminders = page.getByRole("region", { name: "Fee Reminders" });
  await reminders.getByLabel("Days before a Fee is due").fill(lead);
  await reminders.getByLabel("Days between reminders while Overdue").fill(interval);
  await reminders.getByRole("button", { name: "Save timings" }).click();
  await expect(reminders.getByRole("status").filter({ hasText: "Timings saved." })).toBeVisible();
}

test("the Admin sets the Fee Reminder timings, sends reminders now and opens the no-email report", async ({ page }) => {
  await logInAsAdmin(page);
  await register(page, "Rana Reminders", "REM-2101", "rana.family@mail.test");
  await register(page, "Sami Reminders", "REM-2102", "");

  // The timings, on the Fees page.
  await open(page, "/admin/fees");
  await saveTimings(page, "10", "3");
  await open(page, "/admin/fees");
  const reminders = page.getByRole("region", { name: "Fee Reminders" });
  await expect(reminders.getByLabel("Days before a Fee is due")).toHaveValue("10");
  await expect(reminders.getByLabel("Days between reminders while Overdue")).toHaveValue("3");
  await saveTimings(page, "7", "7");
  await expectNoSidewaysScroll(page);

  // A Fee owed by both: Rana is emailed, Sami (no email) is skipped.
  await page.getByLabel("Name").fill("Reminders Spec Trip");
  await page.getByLabel("Amount (AED)").fill("250");
  await page.getByLabel("Due date", { exact: true }).fill("2026-11-20");
  await page.getByRole("button", { name: "Define Fee" }).click();
  await page.getByRole("link", { name: "Reminders Spec Trip" }).click();
  await expect(page.getByRole("heading", { name: "Reminders Spec Trip" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Rana Reminders (REM-2101)").check();
  await page.getByLabel("Sami Reminders (REM-2102)").check();
  await page.getByRole("button", { name: "Apply" }).last().click();
  await expect(page.getByRole("status").filter({ hasText: "New Fee Assignments: 2." })).toBeVisible();

  const sendNow = page.getByRole("region", { name: "Send reminders now" });
  await sendNow.getByRole("button", { name: "Send reminders now" }).click();
  await expect(
    sendNow.getByRole("status").filter({ hasText: "Reminders sent: 1. Skipped, no email: 1. Already reminded today: 0." }),
  ).toBeVisible();
  await sendNow.getByRole("button", { name: "Send reminders now" }).click();
  await expect(
    sendNow.getByRole("status").filter({ hasText: "Reminders sent: 0. Skipped, no email: 1. Already reminded today: 1." }),
  ).toBeVisible();
  await expectNoSidewaysScroll(page);

  // The no-email report, linked from the Fees page.
  await open(page, "/admin/fees");
  await page.getByRole("link", { name: "Students with no email" }).click();
  await expect(page.getByRole("heading", { name: "Students with no email" })).toBeVisible();
  const sami = page.getByRole("row").filter({ hasText: "Sami Reminders (REM-2102)" });
  await expect(sami.getByRole("cell", { name: "Yes", exact: true })).toBeVisible();
  await expect(sami.getByRole("cell", { name: "Guardian of Sami Reminders, +971 50 210 0000" })).toBeVisible();
  await expect(page.getByText("Rana Reminders")).toHaveCount(0);
  await expectNoSidewaysScroll(page);
});

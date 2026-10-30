import { expect, test, type Page } from "@playwright/test";

// Names and dates here are unique to this spec: e2e specs share one database.
// The Academic Year is in the past so the Lesson date is never in the future,
// whatever day the test runs. The project runs at phone width (Pixel 7).
async function logIn(page: Page, identifier: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email, phone or Student Number").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

async function firstLogin(page: Page, email: string, initialPassword: string, newPassword: string) {
  await page.context().clearCookies();
  await logIn(page, email, initialPassword);
  await page.getByLabel("Current password").fill(initialPassword);
  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirm new password").fill(newPassword);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page).toHaveURL(/\/teacher$/);
}

async function addTeacher(page: Page, name: string, email: string): Promise<string> {
  await page.goto("/admin/teachers");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Add Teacher" }).click();
  return (await page.getByRole("status").locator("code").textContent())!;
}

async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test("a Subject Teacher logs a Lesson from a phone, and the Class Teacher and Admin see it", async ({ page }) => {
  await logIn(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!);
  await expect(page).toHaveURL(/\/admin$/);

  await page.goto("/admin/academic-years");
  await page.getByLabel("Academic Year name").fill("2001-2002");
  await page.getByLabel("First day", { exact: true }).fill("2001-09-01");
  await page.getByLabel("Last day", { exact: true }).fill("2002-06-30");
  await page.getByLabel("Term 1 name").fill("Whole year");
  await page.getByLabel("Term 1 first day").fill("2001-09-01");
  await page.getByLabel("Term 1 last day").fill("2002-06-30");
  await page.getByRole("button", { name: "Create Academic Year" }).click();
  await expect(page.getByRole("heading", { name: /2001-2002/ })).toBeVisible();

  await page.goto("/admin/grades");
  await page.getByLabel("Grade name").first().fill("Grade 4");
  await page.getByRole("button", { name: "Add" }).click();
  // The list is sorted and shared with other specs, so find the row by its value.
  await expect(page.locator('input[name="name"][value="Grade 4"]')).toBeVisible();

  await page.goto("/admin/subjects");
  await page.getByLabel("Subject name").first().fill("Geography");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.locator('input[name="name"][value="Geography"]')).toBeVisible();

  await page.goto("/admin/periods");
  await page.getByLabel("Number of Periods in the school day").fill("8");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();

  const laylaPassword = await addTeacher(page, "Layla Geography", "layla@school.test");
  const karimPassword = await addTeacher(page, "Karim Homeroom", "karim@school.test");

  await page.goto("/admin/classes");
  await page.getByRole("combobox", { name: "Academic Year" }).selectOption({ label: "2001-2002" });
  await page.getByRole("combobox", { name: "Grade", exact: true }).selectOption({ label: "Grade 4" });
  await page.getByLabel("Class name").fill("4-L");
  await page.getByRole("combobox", { name: "Class Teacher" }).selectOption({ label: "Karim Homeroom" });
  await page.getByRole("button", { name: "Add Class" }).click();
  await page.getByRole("link", { name: "4-L" }).click();
  await expect(page.getByRole("heading", { name: "4-L" })).toBeVisible();
  const classUrl = page.url();
  await page.getByRole("combobox", { name: "Subject", exact: true }).selectOption({ label: "Geography" });
  await page.getByRole("combobox", { name: "Subject Teacher", exact: true }).selectOption({ label: "Layla Geography" });
  await page.getByRole("button", { name: "Add Class Subject" }).click();
  await expect(page.getByRole("combobox", { name: "Subject Teacher of Geography" })).toHaveValue(/.+/);

  // Layla, the Subject Teacher, logs a Lesson on her phone.
  await firstLogin(page, "layla@school.test", laylaPassword, "layla's own password");
  await page.getByRole("region", { name: "My Class Subjects" }).getByRole("link", { name: "Geography for 4-L" }).click();
  const form = page.getByRole("region", { name: "Log a Lesson" });
  await expect(form).toBeVisible();
  await expectNoSidewaysScroll(page);
  await form.getByLabel("Date").fill("2001-10-15");
  await form.getByRole("radio", { name: "Period 2" }).check();
  await form.getByLabel("Topic").fill("Rivers and deltas");
  await form.getByLabel("Homework (optional)").fill("Draw the Nile delta");
  await form.getByRole("button", { name: "Log Lesson" }).click();
  await expect(form.getByRole("status").filter({ hasText: "Lesson logged." })).toBeVisible();
  await expect(form.getByLabel("Topic")).toHaveValue("");
  const lessons = page.getByRole("region", { name: "Lessons" });
  await expect(lessons.getByText("Rivers and deltas")).toBeVisible();

  // The same date and Period again is refused, and what she typed is kept.
  await form.getByRole("radio", { name: "Period 2" }).check();
  await form.getByLabel("Topic").fill("Mountains");
  await form.getByRole("button", { name: "Log Lesson" }).click();
  await expect(
    form.getByRole("alert").filter({ hasText: "A Lesson is already logged for that date and Period." }),
  ).toBeVisible();
  await expect(form.getByLabel("Topic")).toHaveValue("Mountains");

  // Karim, the Class Teacher, sees the class summary but can't log a Lesson for Geography.
  await firstLogin(page, "karim@school.test", karimPassword, "karim's own password");
  await page.getByRole("region", { name: "My Classes" }).getByRole("link", { name: "4-L" }).click();
  await page.getByRole("link", { name: "Class summary of Lessons" }).click();
  await expect(page.getByRole("heading", { name: "Lessons in 4-L" })).toBeVisible();
  const day = page.getByRole("region", { name: "2001-10-15" });
  await expect(day.getByText("Period 2: Geography, Layla Geography")).toBeVisible();
  await expect(day.getByText("Rivers and deltas")).toBeVisible();
  await expect(day.getByText("Homework: Draw the Nile delta")).toBeVisible();
  await expectNoSidewaysScroll(page);

  await page.goto("/teacher");
  await page.getByRole("region", { name: "My Classes" }).getByRole("link", { name: "4-L" }).click();
  await page.getByRole("link", { name: "Geography: Layla Geography" }).click();
  await expect(page.getByRole("heading", { name: "Geography for 4-L" })).toBeVisible();
  await expect(page.getByText("Rivers and deltas")).toBeVisible();
  await expect(page.getByRole("region", { name: "Log a Lesson" })).toHaveCount(0);

  // The Admin sees the same summary.
  await page.context().clearCookies();
  await logIn(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!);
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto(classUrl);
  await page.getByRole("link", { name: "Class summary of Lessons" }).click();
  await expect(page.getByRole("heading", { name: "Lessons in 4-L" })).toBeVisible();
  await expect(page.getByText("Period 2: Geography, Layla Geography")).toBeVisible();
});

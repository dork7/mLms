import { expect, test, type Page } from "@playwright/test";

// Names and dates here are unique to this spec: e2e specs share one database and run
// in parallel. The year (2051-2052) is far in the future so it overlaps no other
// spec's year; the grid is the roster on the Assessment's date, not today's. The
// project runs at phone width (Pixel 7).
async function logIn(page: Page, identifier: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email, phone or Student Number").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

async function changeInitialPassword(page: Page, initialPassword: string, newPassword: string) {
  await page.getByLabel("Current password").fill(initialPassword);
  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirm new password").fill(newPassword);
  await page.getByRole("button", { name: "Change password" }).click();
}

async function registerAndEnroll(page: Page, name: string, studentNumber: string): Promise<string> {
  await page.goto("/admin/students");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Student Number").fill(studentNumber);
  await page.getByLabel("Date of birth").fill("2039-03-03");
  await page.getByLabel("National ID").fill(`784-${studentNumber}`);
  await page.getByLabel("Guardian contact").fill("Guardian");
  await page.getByLabel("Admission date").fill("2051-08-25");
  await page.getByRole("button", { name: "Register Student" }).click();
  const status = page.getByRole("status").filter({ hasText: studentNumber });
  const password = (await status.locator("code").textContent())!;
  await page.getByRole("listitem").filter({ hasText: name }).getByRole("link", { name: "Profile" }).click();
  await page.getByRole("combobox", { name: "Class" }).selectOption({ label: "11-M (Grade 11, 2051-2052)" });
  await page.getByLabel("From").fill("2051-09-01");
  await page.getByRole("button", { name: "Enroll" }).click();
  await expect(page.getByText("From 2051-09-01 · Current")).toBeVisible();
  return password;
}

async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test("a Subject Teacher enters a whole Class's Marks from a phone, and the Student sees them", async ({ page }) => {
  await logIn(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!);
  await expect(page).toHaveURL(/\/admin$/);

  await page.goto("/admin/academic-years");
  await page.getByLabel("Academic Year name").fill("2051-2052");
  await page.getByLabel("First day", { exact: true }).fill("2051-09-01");
  await page.getByLabel("Last day", { exact: true }).fill("2052-06-30");
  await page.getByLabel("Term 1 name").fill("Whole year");
  await page.getByLabel("Term 1 first day").fill("2051-09-01");
  await page.getByLabel("Term 1 last day").fill("2052-06-30");
  await page.getByRole("button", { name: "Create Academic Year" }).click();
  await expect(page.getByRole("heading", { name: /2051-2052/ })).toBeVisible();

  await page.goto("/admin/grades");
  await page.getByLabel("Grade name").first().fill("Grade 11");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.locator('input[name="name"][value="Grade 11"]')).toBeVisible();

  await page.goto("/admin/subjects");
  await page.getByLabel("Subject name").first().fill("Chemistry");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.locator('input[name="name"][value="Chemistry"]')).toBeVisible();

  await page.goto("/admin/teachers");
  await page.getByLabel("Name").fill("Rania Marks");
  await page.getByLabel("Email").fill("rania.marks@school.test");
  await page.getByRole("button", { name: "Add Teacher" }).click();
  const raniaPassword = (await page.getByRole("status").locator("code").textContent())!;

  await page.goto("/admin/classes");
  await page.getByRole("combobox", { name: "Academic Year" }).selectOption({ label: "2051-2052" });
  await page.getByRole("combobox", { name: "Grade", exact: true }).selectOption({ label: "Grade 11" });
  await page.getByLabel("Class name").fill("11-M");
  await page.getByRole("combobox", { name: "Class Teacher" }).selectOption({ label: "Rania Marks" });
  await page.getByRole("button", { name: "Add Class" }).click();
  await page.getByRole("link", { name: "11-M" }).click();
  await page.getByRole("combobox", { name: "Subject", exact: true }).selectOption({ label: "Chemistry" });
  await page.getByRole("combobox", { name: "Subject Teacher", exact: true }).selectOption({ label: "Rania Marks" });
  await page.getByRole("button", { name: "Add Class Subject" }).click();
  await expect(page.getByRole("combobox", { name: "Subject Teacher of Chemistry" })).toHaveValue(/.+/);

  const huwaidaPassword = await registerAndEnroll(page, "Huwaida Marks", "E2E-8001");
  await registerAndEnroll(page, "Imran Marks", "E2E-8002");

  // Rania creates an Assessment from her phone and enters the grid.
  await page.context().clearCookies();
  await logIn(page, "rania.marks@school.test", raniaPassword);
  await changeInitialPassword(page, raniaPassword, "rania's own password");
  await expect(page).toHaveURL(/\/teacher$/);
  await page.getByRole("region", { name: "My Class Subjects" }).getByRole("link", { name: "Chemistry for 11-M" }).click();
  const create = page.getByRole("region", { name: "New Assessment" });
  await create.getByRole("combobox", { name: "Type" }).selectOption({ label: "Quiz" });
  await create.getByLabel("Date").fill("2051-10-10");
  await create.getByLabel("Maximum marks").fill("20");
  await create.getByLabel("Weight").fill("1");
  await create.getByRole("button", { name: "Create Assessment" }).click();
  await expect(page.getByRole("heading", { name: "Quiz on 2051-10-10" })).toBeVisible();

  const grid = page.getByRole("region", { name: "Marks", exact: true });
  await expect(grid.getByRole("listitem")).toHaveCount(2);
  await expectNoSidewaysScroll(page);

  // An out-of-range score is refused and what she typed is kept.
  await grid.getByLabel("Mark for Huwaida Marks").fill("25");
  await grid.getByRole("combobox", { name: "Status for Imran Marks" }).selectOption({ label: "Absent" });
  await grid.getByRole("button", { name: "Save Marks" }).click();
  await expect(grid.getByRole("alert").filter({ hasText: "from 0 to the maximum" })).toBeVisible();
  await expect(grid.getByLabel("Mark for Huwaida Marks")).toHaveValue("25");

  await grid.getByLabel("Mark for Huwaida Marks").fill("18");
  await grid.getByRole("button", { name: "Save Marks" }).click();
  await expect(grid.getByRole("status").filter({ hasText: "Marks saved." })).toBeVisible();
  await expect(page.getByText("Average 9, highest 18, lowest 0 (2 counted)")).toBeVisible();

  // Raising the maximum keeps the raw Mark, and doesn't lose what she has typed but not saved.
  const edit = page.getByRole("region", { name: "Maximum marks and weight" });
  await edit.getByLabel("Maximum marks").fill("24");
  await grid.getByRole("combobox", { name: "Status for Imran Marks" }).selectOption({ label: "Exempt" });
  await edit.getByRole("button", { name: "Save" }).click();
  await expect(edit.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
  await expect(grid.getByLabel("Mark for Huwaida Marks")).toHaveValue("18");
  await expect(grid.getByRole("combobox", { name: "Status for Imran Marks" })).toHaveValue("exempt");
  await grid.getByRole("combobox", { name: "Status for Imran Marks" }).selectOption({ label: "Absent" });
  await expectNoSidewaysScroll(page);

  // The Class Subject page lists the Assessment with its statistics.
  await page.getByRole("link", { name: "Back to Chemistry for 11-M" }).click();
  const list = page.getByRole("region", { name: "Assessments" });
  await expect(list.getByRole("link", { name: "Quiz, 2051-10-10" })).toBeVisible();
  await expect(list.getByText("Average 9, highest 18, lowest 0 (2 counted)")).toBeVisible();

  // The Student sees her own Mark, recalculated against the new maximum.
  await page.context().clearCookies();
  await logIn(page, "E2E-8001", huwaidaPassword);
  await changeInitialPassword(page, huwaidaPassword, "huwaida's own password");
  await expect(page).toHaveURL(/\/student$/);
  const history = page.getByRole("region", { name: "Assessment history" });
  await expect(history.getByText("Chemistry, 11-M: Quiz on 2051-10-10 (Whole year)")).toBeVisible();
  await expect(history.getByText("18 / 24 (75%)")).toBeVisible();
  await expectNoSidewaysScroll(page);
});

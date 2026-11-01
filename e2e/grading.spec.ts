import { expect, test, type Page } from "@playwright/test";

// Names and dates here are unique to this spec: e2e specs share one database and run
// in parallel. The year (2081-2082) is far in the future so it overlaps no other spec's
// year; Term Grades go by Assessment dates, not today. The project runs at phone width.
async function logIn(page: Page, identifier: string, password: string) {
  await page.goto("/login");
  await settled(page);
  await page.getByLabel("Email, phone or Student Number").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

/** A controlled form touched before React hydrates loses its values (see conventions, ticket 13). */
async function settled(page: Page) {
  await page.waitForLoadState("networkidle");
}

async function open(page: Page, path: string) {
  await page.goto(path);
  await settled(page);
}

async function changeInitialPassword(page: Page, initialPassword: string, newPassword: string) {
  await settled(page);
  await page.getByLabel("Current password").fill(initialPassword);
  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirm new password").fill(newPassword);
  await page.getByRole("button", { name: "Change password" }).click();
}

async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

/** From a Class Subject's page: creates a 10-mark quiz on a date and enters one Student's Mark. */
async function quizWithMark(page: Page, classSubject: string, date: string, student: string, score: string) {
  await open(page, "/teacher");
  await page.getByRole("region", { name: "My Class Subjects" }).getByRole("link", { name: classSubject }).click();
  const create = page.getByRole("region", { name: "New Assessment" });
  await expect(create).toBeVisible();
  await settled(page);
  await create.getByRole("combobox", { name: "Type" }).selectOption({ label: "Quiz" });
  await create.getByLabel("Date").fill(date);
  await create.getByLabel("Maximum marks").fill("10");
  await create.getByLabel("Weight").fill("1");
  await create.getByRole("button", { name: "Create Assessment" }).click();
  await expect(page.getByRole("heading", { name: `Quiz on ${date}` })).toBeVisible();
  await settled(page);
  const grid = page.getByRole("region", { name: "Marks", exact: true });
  await grid.getByLabel(`Mark for ${student}`).fill(score);
  await grid.getByRole("button", { name: "Save Marks" }).click();
  await expect(grid.getByRole("status").filter({ hasText: "Marks saved." })).toBeVisible();
}

test("the Admin defines a Grading Scale, and a Student who moved Class mid-Term gets one Term Grade from both Classes", async ({
  page,
}) => {
  await logIn(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!);
  await expect(page).toHaveURL(/\/admin$/);

  await open(page, "/admin/academic-years");
  await page.getByLabel("Academic Year name").fill("2081-2082");
  await page.getByLabel("First day", { exact: true }).fill("2081-09-01");
  await page.getByLabel("Last day", { exact: true }).fill("2082-06-30");
  await page.getByLabel("Term 1 name").fill("Whole year");
  await page.getByLabel("Term 1 first day").fill("2081-09-01");
  await page.getByLabel("Term 1 last day").fill("2082-06-30");
  await page.getByRole("button", { name: "Create Academic Year" }).click();
  await expect(page.getByRole("heading", { name: /2081-2082/ })).toBeVisible();

  await open(page, "/admin/grades");
  await page.getByLabel("Grade name").first().fill("Grade 3");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.locator('input[name="name"][value="Grade 3"]')).toBeVisible();

  await open(page, "/admin/subjects");
  await page.getByLabel("Subject name").first().fill("Biology");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.locator('input[name="name"][value="Biology"]')).toBeVisible();

  // The Grading Scale: a refused band keeps what was typed, then the fixed one saves.
  await open(page, "/admin");
  await page.getByRole("link", { name: "Grading Scales" }).click();
  const scale = page.getByRole("region", { name: "Grade 3", exact: true });
  await expect(scale).toBeVisible();
  await settled(page);
  await scale.getByLabel("Pass mark for Grade 3 (%)").fill("50");
  await scale.getByRole("button", { name: "Add a band" }).click();
  await scale.getByRole("button", { name: "Add a band" }).click();
  await scale.getByLabel("Band 1 starts at (%)").fill("80");
  await scale.getByLabel("Band 1 label").fill("Excellent");
  await scale.getByLabel("Band 2 starts at (%)").fill("50");
  await scale.getByLabel("Band 2 label").fill("Good");
  await scale.getByLabel("Band 3 starts at (%)").fill("10");
  await scale.getByLabel("Band 3 label").fill("Below");
  await scale.getByRole("button", { name: "Save Grading Scale for Grade 3" }).click();
  await expect(scale.getByRole("alert").filter({ hasText: "The lowest band must start at 0" })).toBeVisible();
  await expect(scale.getByLabel("Band 1 label")).toHaveValue("Excellent");
  await scale.getByLabel("Band 3 starts at (%)").fill("0");
  await scale.getByRole("button", { name: "Save Grading Scale for Grade 3" }).click();
  await expect(scale.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
  await expectNoSidewaysScroll(page);

  await page.reload();
  await expect(page.getByRole("region", { name: "Grade 3", exact: true }).getByLabel("Band 2 label")).toHaveValue("Good");

  await open(page, "/admin/teachers");
  await page.getByLabel("Name").fill("Layla Grading");
  await page.getByLabel("Email").fill("layla.grading@school.test");
  await page.getByRole("button", { name: "Add Teacher" }).click();
  const laylaPassword = (await page.getByRole("status").locator("code").textContent())!;

  for (const name of ["3-G", "3-H"]) {
    await open(page, "/admin/classes");
    await page.getByRole("combobox", { name: "Academic Year" }).selectOption({ label: "2081-2082" });
    await page.getByRole("combobox", { name: "Grade", exact: true }).selectOption({ label: "Grade 3" });
    await page.getByLabel("Class name").fill(name);
    await page.getByRole("combobox", { name: "Class Teacher" }).selectOption({ label: "Layla Grading" });
    await page.getByRole("button", { name: "Add Class" }).click();
    await page.getByRole("link", { name }).click();
    await expect(page.getByRole("button", { name: "Add Class Subject" })).toBeVisible();
    await settled(page);
    await page.getByRole("combobox", { name: "Subject", exact: true }).selectOption({ label: "Biology" });
    await page.getByRole("combobox", { name: "Subject Teacher", exact: true }).selectOption({ label: "Layla Grading" });
    await page.getByRole("button", { name: "Add Class Subject" }).click();
    await expect(page.getByRole("combobox", { name: "Subject Teacher of Biology" })).toHaveValue(/.+/);
  }

  await open(page, "/admin/students");
  await page.getByLabel("Name").fill("Noor Grading");
  await page.getByLabel("Student Number").fill("E2E-9001");
  await page.getByLabel("Date of birth").fill("2069-03-03");
  await page.getByLabel("National ID").fill("784-E2E-9001");
  await page.getByLabel("Guardian contact").fill("Guardian");
  await page.getByLabel("Admission date").fill("2081-08-25");
  await page.getByRole("button", { name: "Register Student" }).click();
  const noorStatus = page.getByRole("status").filter({ hasText: "E2E-9001" });
  const noorPassword = (await noorStatus.locator("code").textContent())!;
  await page.getByRole("listitem").filter({ hasText: "Noor Grading" }).getByRole("link", { name: "Profile" }).click();
  await expect(page).toHaveURL(/\/admin\/students\/[^/]+$/);
  await settled(page);
  const profileUrl = page.url();
  await page.getByRole("combobox", { name: "Class" }).selectOption({ label: "3-G (Grade 3, 2081-2082)" });
  await page.getByLabel("From").fill("2081-09-01");
  await page.getByRole("button", { name: "Enroll" }).click();
  await expect(page.getByText("From 2081-09-01 · Current")).toBeVisible();

  // Layla marks Noor in 3-G.
  await page.context().clearCookies();
  await logIn(page, "layla.grading@school.test", laylaPassword);
  await changeInitialPassword(page, laylaPassword, "layla's own password");
  await expect(page).toHaveURL(/\/teacher$/);
  await quizWithMark(page, "Biology for 3-G", "2081-10-10", "Noor Grading", "8");

  // The Admin moves Noor to 3-H mid-Term.
  await page.context().clearCookies();
  await logIn(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!);
  await expect(page).toHaveURL(/\/admin$/);
  await open(page, profileUrl);
  await page.getByRole("combobox", { name: "Class" }).selectOption({ label: "3-H (Grade 3, 2081-2082)" });
  await page.getByLabel("From").fill("2081-11-01");
  await page.getByRole("button", { name: "Move" }).click();
  await expect(page.getByText("From 2081-11-01 · Current")).toBeVisible();

  // Layla marks Noor in 3-H. Her Term Grade is (8/10 + 4/10) ÷ 2 = 60%.
  await page.context().clearCookies();
  await logIn(page, "layla.grading@school.test", "layla's own password");
  await expect(page).toHaveURL(/\/teacher$/);
  await quizWithMark(page, "Biology for 3-H", "2081-11-10", "Noor Grading", "4");

  // 3-G's Term Grades still list Noor, with the whole figure and her Class on the last day.
  await open(page, "/teacher");
  await page.getByRole("region", { name: "My Class Subjects" }).getByRole("link", { name: "Biology for 3-G" }).click();
  await page.getByRole("link", { name: "Term Grades" }).click();
  await expect(page.getByRole("heading", { name: "Term Grades: Biology for 3-G" })).toBeVisible();
  const list = page.getByRole("region", { name: "Whole year (2081-2082)" });
  const row = list.getByRole("listitem").filter({ hasText: "Noor Grading (E2E-9001)" });
  await expect(row.getByText("60%, Good, Pass")).toBeVisible();
  await expect(row.getByText("Class on the Term's last day: 3-H")).toBeVisible();
  await expect(list.getByRole("combobox", { name: "Term" })).toHaveValue(/\d+/);
  await list.getByRole("button", { name: "Show" }).click();
  await expect(row.getByText("60%, Good, Pass")).toBeVisible();
  await expectNoSidewaysScroll(page);

  // Noor sees her own Term Grade.
  await page.context().clearCookies();
  await logIn(page, "E2E-9001", noorPassword);
  await changeInitialPassword(page, noorPassword, "noor's own password");
  await expect(page).toHaveURL(/\/student$/);
  await page.getByRole("link", { name: "My profile" }).click();
  const termGrades = page.getByRole("region", { name: "Term Grades" });
  await expect(termGrades.getByText("Whole year (2081-2082)")).toBeVisible();
  await expect(termGrades.getByText("Class on the Term's last day: 3-H")).toBeVisible();
  const biology = termGrades.getByRole("listitem").filter({ hasText: "Biology" });
  await expect(biology.getByText("60%, Good, Pass")).toBeVisible();
  await expectNoSidewaysScroll(page);
});

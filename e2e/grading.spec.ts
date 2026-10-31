import { expect, test, type Page } from "@playwright/test";

// Names and dates here are unique to this spec: e2e specs share one database and run
// in parallel. The year (2061-2062) is far in the future so it overlaps no other spec's
// year; Term Grades go by Assessment dates, not today. The project runs at phone width.
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

async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

/** From a Class Subject's page: creates a 10-mark quiz on a date and enters one Student's Mark. */
async function quizWithMark(page: Page, classSubject: string, date: string, student: string, score: string) {
  await page.goto("/teacher");
  await page.getByRole("region", { name: "My Class Subjects" }).getByRole("link", { name: classSubject }).click();
  const create = page.getByRole("region", { name: "New Assessment" });
  await create.getByRole("combobox", { name: "Type" }).selectOption({ label: "Quiz" });
  await create.getByLabel("Date").fill(date);
  await create.getByLabel("Maximum marks").fill("10");
  await create.getByLabel("Weight").fill("1");
  await create.getByRole("button", { name: "Create Assessment" }).click();
  await expect(page.getByRole("heading", { name: `Quiz on ${date}` })).toBeVisible();
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

  await page.goto("/admin/academic-years");
  await page.getByLabel("Academic Year name").fill("2061-2062");
  await page.getByLabel("First day", { exact: true }).fill("2061-09-01");
  await page.getByLabel("Last day", { exact: true }).fill("2062-06-30");
  await page.getByLabel("Term 1 name").fill("Whole year");
  await page.getByLabel("Term 1 first day").fill("2061-09-01");
  await page.getByLabel("Term 1 last day").fill("2062-06-30");
  await page.getByRole("button", { name: "Create Academic Year" }).click();
  await expect(page.getByRole("heading", { name: /2061-2062/ })).toBeVisible();

  await page.goto("/admin/grades");
  await page.getByLabel("Grade name").first().fill("Grade 12");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.locator('input[name="name"][value="Grade 12"]')).toBeVisible();

  await page.goto("/admin/subjects");
  await page.getByLabel("Subject name").first().fill("Biology");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.locator('input[name="name"][value="Biology"]')).toBeVisible();

  // The Grading Scale: a refused band keeps what was typed, then the fixed one saves.
  await page.goto("/admin");
  await page.getByRole("link", { name: "Grading Scales" }).click();
  const scale = page.getByRole("region", { name: "Grade 12" });
  await scale.getByLabel("Pass mark for Grade 12 (%)").fill("50");
  await scale.getByRole("button", { name: "Add a band" }).click();
  await scale.getByRole("button", { name: "Add a band" }).click();
  await scale.getByLabel("Band 1 starts at (%)").fill("80");
  await scale.getByLabel("Band 1 label").fill("Excellent");
  await scale.getByLabel("Band 2 starts at (%)").fill("50");
  await scale.getByLabel("Band 2 label").fill("Good");
  await scale.getByLabel("Band 3 starts at (%)").fill("10");
  await scale.getByLabel("Band 3 label").fill("Below");
  await scale.getByRole("button", { name: "Save Grading Scale for Grade 12" }).click();
  await expect(scale.getByRole("alert").filter({ hasText: "The lowest band must start at 0" })).toBeVisible();
  await expect(scale.getByLabel("Band 1 label")).toHaveValue("Excellent");
  await scale.getByLabel("Band 3 starts at (%)").fill("0");
  await scale.getByRole("button", { name: "Save Grading Scale for Grade 12" }).click();
  await expect(scale.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
  await expectNoSidewaysScroll(page);

  await page.reload();
  await expect(page.getByRole("region", { name: "Grade 12" }).getByLabel("Band 2 label")).toHaveValue("Good");

  await page.goto("/admin/teachers");
  await page.getByLabel("Name").fill("Layla Grading");
  await page.getByLabel("Email").fill("layla.grading@school.test");
  await page.getByRole("button", { name: "Add Teacher" }).click();
  const laylaPassword = (await page.getByRole("status").locator("code").textContent())!;

  for (const name of ["12-G", "12-H"]) {
    await page.goto("/admin/classes");
    await page.getByRole("combobox", { name: "Academic Year" }).selectOption({ label: "2061-2062" });
    await page.getByRole("combobox", { name: "Grade", exact: true }).selectOption({ label: "Grade 12" });
    await page.getByLabel("Class name").fill(name);
    await page.getByRole("combobox", { name: "Class Teacher" }).selectOption({ label: "Layla Grading" });
    await page.getByRole("button", { name: "Add Class" }).click();
    await page.getByRole("link", { name }).click();
    await page.getByRole("combobox", { name: "Subject", exact: true }).selectOption({ label: "Biology" });
    await page.getByRole("combobox", { name: "Subject Teacher", exact: true }).selectOption({ label: "Layla Grading" });
    await page.getByRole("button", { name: "Add Class Subject" }).click();
    await expect(page.getByRole("combobox", { name: "Subject Teacher of Biology" })).toHaveValue(/.+/);
  }

  await page.goto("/admin/students");
  await page.getByLabel("Name").fill("Noor Grading");
  await page.getByLabel("Student Number").fill("E2E-9001");
  await page.getByLabel("Date of birth").fill("2049-03-03");
  await page.getByLabel("National ID").fill("784-E2E-9001");
  await page.getByLabel("Guardian contact").fill("Guardian");
  await page.getByLabel("Admission date").fill("2061-08-25");
  await page.getByRole("button", { name: "Register Student" }).click();
  const noorStatus = page.getByRole("status").filter({ hasText: "E2E-9001" });
  const noorPassword = (await noorStatus.locator("code").textContent())!;
  await page.getByRole("listitem").filter({ hasText: "Noor Grading" }).getByRole("link", { name: "Profile" }).click();
  await expect(page).toHaveURL(/\/admin\/students\/[^/]+$/);
  const profileUrl = page.url();
  await page.getByRole("combobox", { name: "Class" }).selectOption({ label: "12-G (Grade 12, 2061-2062)" });
  await page.getByLabel("From").fill("2061-09-01");
  await page.getByRole("button", { name: "Enroll" }).click();
  await expect(page.getByText("From 2061-09-01 · Current")).toBeVisible();

  // Layla marks Noor in 12-G.
  await page.context().clearCookies();
  await logIn(page, "layla.grading@school.test", laylaPassword);
  await changeInitialPassword(page, laylaPassword, "layla's own password");
  await expect(page).toHaveURL(/\/teacher$/);
  await quizWithMark(page, "Biology for 12-G", "2061-10-10", "Noor Grading", "8");

  // The Admin moves Noor to 12-H mid-Term.
  await page.context().clearCookies();
  await logIn(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!);
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto(profileUrl);
  await page.getByRole("combobox", { name: "Class" }).selectOption({ label: "12-H (Grade 12, 2061-2062)" });
  await page.getByLabel("From").fill("2061-11-01");
  await page.getByRole("button", { name: "Move" }).click();
  await expect(page.getByText("From 2061-11-01 · Current")).toBeVisible();

  // Layla marks Noor in 12-H. Her Term Grade is (8/10 + 4/10) ÷ 2 = 60%.
  await page.context().clearCookies();
  await logIn(page, "layla.grading@school.test", "layla's own password");
  await expect(page).toHaveURL(/\/teacher$/);
  await quizWithMark(page, "Biology for 12-H", "2061-11-10", "Noor Grading", "4");

  // 12-G's Term Grades still list Noor, with the whole figure and her Class on the last day.
  await page.goto("/teacher");
  await page.getByRole("region", { name: "My Class Subjects" }).getByRole("link", { name: "Biology for 12-G" }).click();
  await page.getByRole("link", { name: "Term Grades" }).click();
  await expect(page.getByRole("heading", { name: "Term Grades: Biology for 12-G" })).toBeVisible();
  const list = page.getByRole("region", { name: "Whole year (2061-2062)" });
  const row = list.getByRole("listitem").filter({ hasText: "Noor Grading (E2E-9001)" });
  await expect(row.getByText("60%, Good, Pass")).toBeVisible();
  await expect(row.getByText("Class on the Term's last day: 12-H")).toBeVisible();
  await expect(list.getByRole("combobox", { name: "Term" })).toHaveValue(/\d+/);
  await list.getByRole("button", { name: "Show" }).click();
  await expect(row.getByText("60%, Good, Pass")).toBeVisible();
  await expectNoSidewaysScroll(page);

  // Noor sees her own Term Grade.
  await page.context().clearCookies();
  await logIn(page, "E2E-9001", noorPassword);
  await changeInitialPassword(page, noorPassword, "noor's own password");
  await expect(page).toHaveURL(/\/student$/);
  const termGrades = page.getByRole("region", { name: "Term Grades" });
  await expect(termGrades.getByText("Whole year (2061-2062)")).toBeVisible();
  await expect(termGrades.getByText("Class on the Term's last day: 12-H")).toBeVisible();
  const biology = termGrades.getByRole("listitem").filter({ hasText: "Biology" });
  await expect(biology.getByText("60%, Good, Pass")).toBeVisible();
  await expectNoSidewaysScroll(page);
});

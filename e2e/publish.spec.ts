import { expect, test, type Page } from "@playwright/test";

// Names and dates here are unique to this spec: e2e specs share one database and run in
// parallel. It owns year 2091-2092, Grade 23 and Oceanography, and says nothing about rank,
// since report-cards.spec owns that switch. The project runs at phone width.
async function logIn(page: Page, identifier: string, password: string) {
  await page.context().clearCookies();
  await open(page, "/login");
  await page.getByLabel("Email, phone or Student Number").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

/** A controlled form touched before React hydrates loses its values (see conventions, ticket 13). */
async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

async function logInAsAdmin(page: Page) {
  await logIn(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!);
  await expect(page).toHaveURL(/\/admin$/);
}

/** Logs in with an initial password, changes it, and ends on the landing page. */
async function firstLogIn(page: Page, identifier: string, initial: string, own: string, landing: RegExp) {
  await logIn(page, identifier, initial);
  await expect(page.getByLabel("Current password")).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Current password").fill(initial);
  await page.getByLabel("New password", { exact: true }).fill(own);
  await page.getByLabel("Confirm new password").fill(own);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page).toHaveURL(landing);
}

async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

const STUDENT_LOGIN = "E2E-9101";
const STUDENT_PASSWORD = "laila's own password";
const TEACHER_LOGIN = "nour.publish@school.test";
const TEACHER_PASSWORD = "nour's own password";

test("the Admin Publishes a Class's Report Cards, Marks freeze, and unpublishing is recorded", async ({ page }) => {
  await logInAsAdmin(page);

  await open(page, "/admin/academic-years");
  await page.getByLabel("Academic Year name").fill("2091-2092");
  await page.getByLabel("First day", { exact: true }).fill("2091-09-01");
  await page.getByLabel("Last day", { exact: true }).fill("2092-06-30");
  await page.getByLabel("Term 1 name").fill("Whole of 2091");
  await page.getByLabel("Term 1 first day").fill("2091-09-01");
  await page.getByLabel("Term 1 last day").fill("2092-06-30");
  await page.getByRole("button", { name: "Create Academic Year" }).click();
  await expect(page.getByRole("heading", { name: /2091-2092/ })).toBeVisible();

  await open(page, "/admin/grades");
  await page.getByLabel("Grade name").first().fill("Grade 23");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.locator('input[name="name"][value="Grade 23"]')).toBeVisible();

  await open(page, "/admin/subjects");
  await page.getByLabel("Subject name").first().fill("Oceanography");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.locator('input[name="name"][value="Oceanography"]')).toBeVisible();

  await open(page, "/admin/teachers");
  await page.getByLabel("Name").fill("Nour Publish");
  await page.getByLabel("Email").fill(TEACHER_LOGIN);
  await page.getByRole("button", { name: "Add Teacher" }).click();
  const teacherInitial = (await page.getByRole("status").locator("code").textContent())!;

  await open(page, "/admin/classes");
  await page.getByRole("combobox", { name: "Academic Year" }).selectOption({ label: "2091-2092" });
  await page.getByRole("combobox", { name: "Grade", exact: true }).selectOption({ label: "Grade 23" });
  await page.getByLabel("Class name").fill("23-P");
  await page.getByRole("combobox", { name: "Class Teacher" }).selectOption({ label: "Nour Publish" });
  await page.getByRole("button", { name: "Add Class" }).click();
  await page.getByRole("link", { name: "23-P" }).click();
  await expect(page.getByRole("button", { name: "Add Class Subject" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.getByRole("combobox", { name: "Subject", exact: true }).selectOption({ label: "Oceanography" });
  await page.getByRole("combobox", { name: "Subject Teacher", exact: true }).selectOption({ label: "Nour Publish" });
  await page.getByRole("button", { name: "Add Class Subject" }).click();
  await expect(page.getByRole("combobox", { name: "Subject Teacher of Oceanography" })).toHaveValue(/.+/);

  await open(page, "/admin/students");
  await page.getByLabel("Name").fill("Laila Publish");
  await page.getByLabel("Student Number").fill(STUDENT_LOGIN);
  await page.getByLabel("Date of birth").fill("2079-03-03");
  await page.getByLabel("National ID").fill(`784-${STUDENT_LOGIN}`);
  await page.getByLabel("Guardian contact").fill("Guardian");
  await page.getByLabel("Admission date").fill("2091-08-25");
  await page.getByRole("button", { name: "Register Student" }).click();
  const studentStatus = page.getByRole("status").filter({ hasText: STUDENT_LOGIN });
  await expect(studentStatus).toBeVisible();
  const studentInitial = (await studentStatus.locator("code").textContent())!;
  await page.getByRole("listitem").filter({ hasText: "Laila Publish" }).getByRole("link", { name: "Profile" }).click();
  await expect(page).toHaveURL(/\/admin\/students\/[^/]+$/);
  await page.waitForLoadState("networkidle");
  await page.getByRole("combobox", { name: "Class" }).selectOption({ label: "23-P (Grade 23, 2091-2092)" });
  await page.getByLabel("From").fill("2091-09-01");
  await page.getByRole("button", { name: "Enroll" }).click();
  await expect(page.getByText("From 2091-09-01 · Current")).toBeVisible();

  // Nour enters a Mark.
  await firstLogIn(page, TEACHER_LOGIN, teacherInitial, TEACHER_PASSWORD, /\/teacher$/);
  await open(page, "/teacher");
  await page.getByRole("region", { name: "My Class Subjects" }).getByRole("link", { name: "Oceanography for 23-P" }).click();
  const create = page.getByRole("region", { name: "New Assessment" });
  await expect(create).toBeVisible();
  await page.waitForLoadState("networkidle");
  await create.getByRole("combobox", { name: "Type" }).selectOption({ label: "Quiz" });
  await create.getByLabel("Date").fill("2091-10-10");
  await create.getByLabel("Maximum marks").fill("10");
  await create.getByLabel("Weight").fill("1");
  await create.getByRole("button", { name: "Create Assessment" }).click();
  await expect(page.getByRole("heading", { name: "Quiz on 2091-10-10" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  const assessmentUrl = page.url();
  const grid = page.getByRole("region", { name: "Marks", exact: true });
  await grid.getByLabel("Mark for Laila Publish").fill("7");
  await grid.getByRole("button", { name: "Save Marks" }).click();
  await expect(grid.getByRole("status").filter({ hasText: "Marks saved." })).toBeVisible();

  // Laila sees no Report Card before Publish.
  await firstLogIn(page, STUDENT_LOGIN, studentInitial, STUDENT_PASSWORD, /\/student$/);
  await open(page, "/student");
  await page.getByRole("link", { name: "My Report Cards" }).click();
  await expect(page.getByRole("heading", { name: "My Report Cards" })).toBeVisible();
  await expect(page.getByText("None of your Report Cards are Published yet.")).toBeVisible();

  // The Admin Publishes from the preview.
  await logInAsAdmin(page);
  await open(page, "/admin/report-cards");
  await page.getByRole("link", { name: "23-P" }).click();
  await expect(page.getByRole("heading", { name: "Report Cards: 23-P" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  const previewUrl = page.url();
  const publish = page.getByRole("region", { name: "Publish", exact: true });
  await expect(publish.getByText("Not Published.")).toBeVisible();
  await expect(publish.getByText("1 of them still have something missing.")).toBeVisible();
  await publish.getByRole("button", { name: "Publish Report Cards" }).click();
  await expect(publish.getByRole("button", { name: "Unpublish Report Cards" })).toBeVisible();
  await expect(publish.getByText(/^Published by .+ Students can see these Report Cards/)).toBeVisible();
  await expectNoSidewaysScroll(page);

  // Laila now sees it.
  await logIn(page, STUDENT_LOGIN, STUDENT_PASSWORD);
  await expect(page).toHaveURL(/\/student$/);
  await open(page, "/student/report-cards");
  const card = page.getByRole("region", { name: "Whole of 2091 (2091-2092)" });
  await expect(card.getByText("Overall: 70%")).toBeVisible();
  await expect(card.getByText("Oceanography")).toBeVisible();
  await expectNoSidewaysScroll(page);

  // Nour's grid and remarks are read-only, and the Teacher isn't offered the maximum or weight.
  await logIn(page, TEACHER_LOGIN, TEACHER_PASSWORD);
  await expect(page).toHaveURL(/\/teacher$/);
  await open(page, assessmentUrl);
  await expect(page.getByText("A Published Report Card freezes these Marks.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save Marks" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Maximum marks and weight" })).toHaveCount(0);
  await open(page, assessmentUrl.replace(/\/teacher\/assessments\/.+$/, "/teacher"));
  await page.getByRole("region", { name: "My Classes" }).getByRole("link", { name: "23-P" }).click();
  await page.getByRole("link", { name: "Write overall remarks" }).click();
  await expect(page.getByText("This Student's Report Card is Published, so the remark can't change.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save remark" })).toHaveCount(0);

  // A Teacher can't Publish or unpublish, or even reach the page.
  await open(page, previewUrl);
  await expect(page.getByText("You don't have access to this page.")).toBeVisible();

  // The Admin unpublishes, and who did it and when is on record.
  await logInAsAdmin(page);
  await open(page, previewUrl);
  await publish.getByRole("button", { name: "Unpublish Report Cards" }).click();
  await expect(publish.getByRole("button", { name: "Publish Report Cards" })).toBeVisible();
  const record = publish.getByRole("list", { name: "Publish record" });
  await expect(record.getByText(/^Published by /)).toBeVisible();
  await expect(record.getByText(/^Unpublished by /)).toBeVisible();

  // Laila no longer sees it, and Nour can enter Marks again.
  await logIn(page, STUDENT_LOGIN, STUDENT_PASSWORD);
  await expect(page).toHaveURL(/\/student$/);
  await open(page, "/student/report-cards");
  await expect(page.getByText("None of your Report Cards are Published yet.")).toBeVisible();

  await logIn(page, TEACHER_LOGIN, TEACHER_PASSWORD);
  await expect(page).toHaveURL(/\/teacher$/);
  await open(page, assessmentUrl);
  const reopened = page.getByRole("region", { name: "Marks", exact: true });
  await reopened.getByLabel("Mark for Laila Publish").fill("8");
  await reopened.getByRole("button", { name: "Save Marks" }).click();
  await expect(reopened.getByRole("status").filter({ hasText: "Marks saved." })).toBeVisible();
});

import { expect, test, type Page } from "@playwright/test";

// Names and dates here are unique to this spec: e2e specs share one database and run in
// parallel, so counts are only checked to be shown, not their value. The dev server uses the
// real clock: this past year's Term has ended, and the Student's open Enrollment still covers
// today. A next Exam needs a future date in a year covering today, which school-setup.spec
// owns, so the Exam shown here is past, and picking the next one is tested at the layer.
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
  await page.waitForLoadState("networkidle");
}

async function logInAsAdmin(page: Page) {
  await page.context().clearCookies();
  await logIn(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!);
  await expect(page).toHaveURL(/\/admin$/);
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

async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test("each role lands on their own dashboard and can act on what it shows", async ({ page }) => {
  await logInAsAdmin(page);

  await open(page, "/admin/academic-years");
  await page.getByLabel("Academic Year name").fill("2015-2016");
  await page.getByLabel("First day", { exact: true }).fill("2015-09-01");
  await page.getByLabel("Last day", { exact: true }).fill("2016-06-30");
  await page.getByLabel("Term 1 name").fill("Whole of 2015");
  await page.getByLabel("Term 1 first day").fill("2015-09-01");
  await page.getByLabel("Term 1 last day").fill("2016-06-30");
  await page.getByRole("button", { name: "Create Academic Year" }).click();
  await expect(page.getByRole("heading", { name: /2015-2016/ })).toBeVisible();

  await addNamed(page, "/admin/grades", "Grade name", "Grade 15");
  await addNamed(page, "/admin/subjects", "Subject name", "Paleontology");
  await addNamed(page, "/admin/rooms", "Room name", "Dashboard Hall");

  await open(page, "/admin/periods");
  await page.getByLabel("Number of Periods in the school day").fill("8");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();

  await open(page, "/admin/teachers");
  await page.getByLabel("Name").fill("Dana Dashboard");
  await page.getByLabel("Email").fill("dana.dashboard@school.test");
  await page.getByRole("button", { name: "Add Teacher" }).click();
  const danaStatus = page.getByRole("status").filter({ hasText: "Dana Dashboard" });
  const danaInitial = (await danaStatus.locator("code").textContent())!;

  await open(page, "/admin/classes");
  await page.getByRole("combobox", { name: "Academic Year" }).selectOption({ label: "2015-2016" });
  await page.getByRole("combobox", { name: "Grade", exact: true }).selectOption({ label: "Grade 15" });
  await page.getByLabel("Class name").fill("15-D");
  await page.getByRole("combobox", { name: "Class Teacher" }).selectOption({ label: "Dana Dashboard" });
  await page.getByRole("button", { name: "Add Class" }).click();
  await page.getByRole("link", { name: "15-D" }).click();
  await expect(page.getByRole("heading", { name: "15-D" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.getByRole("combobox", { name: "Subject", exact: true }).selectOption({ label: "Paleontology" });
  await page.getByRole("combobox", { name: "Subject Teacher", exact: true }).selectOption({ label: "Dana Dashboard" });
  await page.getByRole("button", { name: "Add Class Subject" }).click();
  await expect(page.getByRole("combobox", { name: "Subject Teacher of Paleontology" })).toHaveValue(/.+/);

  await open(page, "/admin/students");
  await page.getByLabel("Name").fill("Sami Dashboard");
  await page.getByLabel("Student Number").fill("E2E-1501");
  await page.getByLabel("Date of birth").fill("2003-03-03");
  await page.getByLabel("National ID").fill("784-E2E-1501");
  await page.getByLabel("Guardian contact").fill("Guardian");
  await page.getByLabel("Admission date").fill("2015-08-25");
  await page.getByRole("button", { name: "Register Student" }).click();
  const samiStatus = page.getByRole("status").filter({ hasText: "E2E-1501" });
  await expect(samiStatus).toBeVisible();
  const samiInitial = (await samiStatus.locator("code").textContent())!;
  await page.getByRole("listitem").filter({ hasText: "Sami Dashboard" }).getByRole("link", { name: "Profile" }).click();
  await expect(page.getByRole("combobox", { name: "Class" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.getByRole("combobox", { name: "Class" }).selectOption({ label: "15-D (Grade 15, 2015-2016)" });
  await page.getByLabel("From").fill("2015-09-01");
  await page.getByRole("button", { name: "Enroll" }).click();
  await expect(page.getByText("From 2015-09-01 · Current")).toBeVisible();

  await open(page, "/admin/exams");
  await page.getByRole("combobox", { name: "Term", exact: true }).selectOption({ label: "2015-2016: Whole of 2015" });
  await page.getByRole("button", { name: "Show" }).click();
  await expect(page.getByRole("heading", { name: "Exams in Whole of 2015 (2015-2016)" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  const add = page.getByRole("region", { name: "Add an Exam" });
  await add.getByRole("combobox", { name: "Class Subject" }).selectOption({ label: "Paleontology for 15-D" });
  await add.getByRole("combobox", { name: "Room" }).selectOption({ label: "Dashboard Hall" });
  await add.getByRole("combobox", { name: "Type" }).selectOption({ label: "Final" });
  await add.getByLabel("Date").fill("2015-11-10");
  await add.getByLabel("Start time").fill("09:00");
  await add.getByLabel("Duration (minutes)").fill("90");
  await add.getByLabel("Maximum marks").fill("100");
  await add.getByLabel("Weight").fill("3");
  await add.getByRole("button", { name: "Add Exam" }).click();
  await expect(page.getByText("15-D in Dashboard Hall")).toBeVisible();

  // The Teacher sees what they teach and what still needs Marks, and a Lesson once logged.
  await logInFirstTime(page, "dana.dashboard@school.test", danaInitial, /\/teacher$/);
  await expectNoSidewaysScroll(page);
  await expect(
    page.getByRole("region", { name: "My Class Subjects" }).getByRole("link", { name: "Paleontology for 15-D" }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Recent Lessons" }).getByText("No Lessons")).toBeVisible();

  await page.getByRole("region", { name: "My Class Subjects" }).getByRole("link", { name: "Paleontology for 15-D" }).click();
  const form = page.getByRole("region", { name: "Log a Lesson" });
  await expect(form).toBeVisible();
  await page.waitForLoadState("networkidle");
  await form.getByLabel("Date").fill("2015-10-15");
  await form.getByRole("radio", { name: "Period 2" }).check();
  await form.getByLabel("Topic").fill("Trilobites");
  await form.getByRole("button", { name: "Log Lesson" }).click();
  await expect(form.getByRole("status").filter({ hasText: "Lesson logged." })).toBeVisible();

  await open(page, "/teacher");
  const lessons = page.getByRole("region", { name: "Recent Lessons" });
  await expect(lessons.getByText("2015-10-15, Period 2: Paleontology, 15-D")).toBeVisible();
  await expect(lessons.getByText("Trilobites")).toBeVisible();

  const needing = page.getByRole("region", { name: "Assessments that need Marks" });
  const final = needing.getByRole("listitem").filter({ hasText: "Paleontology, 15-D: Final on 2015-11-10" });
  await expect(final.getByText("Marks to enter: 1")).toBeVisible();
  await final.getByRole("link").click();
  await expect(page).toHaveURL(/\/teacher\/assessments\/.+$/);
  await page.waitForLoadState("networkidle");
  const grid = page.getByRole("region", { name: "Marks", exact: true });
  await grid.getByLabel("Mark for Sami Dashboard").fill("80");
  await grid.getByRole("button", { name: "Save Marks" }).click();
  await expect(grid.getByRole("status").filter({ hasText: "Marks saved." })).toBeVisible();

  await open(page, "/teacher");
  await expect(needing.getByText("Every Assessment so far has its Marks.")).toBeVisible();
  await expectNoSidewaysScroll(page);

  // The Student sees their latest Mark, and an Exam already past isn't their next one.
  await logInFirstTime(page, "E2E-1501", samiInitial, /\/student$/);
  await expect(page.getByRole("heading", { name: "My dashboard" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Next Exam" }).getByText("No Exam is coming up.")).toBeVisible();
  const marks = page.getByRole("region", { name: "Latest Marks" });
  await expect(marks.getByText("Paleontology, 15-D: Final on 2015-11-10")).toBeVisible();
  await expect(marks.getByText("80 / 100 (80%)")).toBeVisible();
  await expectNoSidewaysScroll(page);
  await page.getByRole("link", { name: "My Exams" }).click();
  await expect(page.getByRole("heading", { name: "My Exams" })).toBeVisible();
  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page).toHaveURL(/\/student$/);

  // The Admin sees the counts and goes from the waiting Report Cards to Publishing them.
  await logInAsAdmin(page);
  await expectNoSidewaysScroll(page);
  for (const label of ["Students enrolled", "Teachers", "Report Cards waiting to be Published"]) {
    await expect(page.locator(".stats > div").filter({ hasText: label }).locator("dd")).toHaveText(/^[1-9]\d*$/);
  }
  await expect(page.locator(".stats dt").filter({ hasText: /^Classes( in .+)?$/ })).toBeVisible();

  const waiting = page.getByRole("region", { name: "Report Cards waiting to be Published" });
  const line = waiting.getByRole("listitem").filter({ hasText: "15-D, Whole of 2015 (2015-2016)" });
  await expect(line.getByText("1", { exact: true })).toBeVisible();
  await line.getByRole("link").click();
  await expect(page.getByRole("heading", { name: "Report Cards: 15-D" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  const publish = page.getByRole("region", { name: "Publish", exact: true });
  await publish.getByRole("button", { name: "Publish Report Cards" }).click();
  await expect(publish.getByRole("button", { name: "Unpublish Report Cards" })).toBeVisible();

  await open(page, "/admin");
  await expect(waiting.getByRole("heading", { name: "Report Cards waiting to be Published" })).toBeVisible();
  await expect(line).toHaveCount(0);
});

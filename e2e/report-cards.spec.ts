import { expect, test, type Page } from "@playwright/test";

// Names and dates here are unique to this spec: e2e specs share one database and run in
// parallel. The year (2071-2072) is far in the future, since a Report Card goes by Term
// dates, not today. The project runs at phone width.
//
// The rank switch is school-wide and no other spec reads it, so this spec owns it.
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

async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

async function registerStudent(page: Page, name: string, studentNumber: string) {
  await open(page, "/admin/students");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Student Number").fill(studentNumber);
  await page.getByLabel("Date of birth").fill("2059-03-03");
  await page.getByLabel("National ID").fill(`784-${studentNumber}`);
  await page.getByLabel("Guardian contact").fill("Guardian");
  await page.getByLabel("Admission date").fill("2071-08-25");
  await page.getByRole("button", { name: "Register Student" }).click();
  await expect(page.getByRole("status").filter({ hasText: studentNumber })).toBeVisible();
  await page.getByRole("listitem").filter({ hasText: name }).getByRole("link", { name: "Profile" }).click();
  await expect(page).toHaveURL(/\/admin\/students\/[^/]+$/);
  await settled(page);
  await page.getByRole("combobox", { name: "Class" }).selectOption({ label: "5-R (Grade 5, 2071-2072)" });
  await page.getByLabel("From").fill("2071-09-01");
  await page.getByRole("button", { name: "Enroll" }).click();
  await expect(page.getByText("From 2071-09-01 · Current")).toBeVisible();
}

test("Teachers write remarks, and the Admin previews a Class's Report Cards with rank and what's missing", async ({
  page,
}) => {
  await logIn(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!);
  await expect(page).toHaveURL(/\/admin$/);

  await open(page, "/admin/academic-years");
  await page.getByLabel("Academic Year name").fill("2071-2072");
  await page.getByLabel("First day", { exact: true }).fill("2071-09-01");
  await page.getByLabel("Last day", { exact: true }).fill("2072-06-30");
  await page.getByLabel("Term 1 name").fill("Whole of 2071");
  await page.getByLabel("Term 1 first day").fill("2071-09-01");
  await page.getByLabel("Term 1 last day").fill("2072-06-30");
  await page.getByRole("button", { name: "Create Academic Year" }).click();
  await expect(page.getByRole("heading", { name: /2071-2072/ })).toBeVisible();

  await open(page, "/admin/grades");
  await page.getByLabel("Grade name").first().fill("Grade 5");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.locator('input[name="name"][value="Grade 5"]')).toBeVisible();

  await open(page, "/admin/subjects");
  await page.getByLabel("Subject name").first().fill("Literature");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.locator('input[name="name"][value="Literature"]')).toBeVisible();

  await open(page, "/admin/teachers");
  await page.getByLabel("Name").fill("Rana Cards");
  await page.getByLabel("Email").fill("rana.cards@school.test");
  await page.getByRole("button", { name: "Add Teacher" }).click();
  const ranaPassword = (await page.getByRole("status").locator("code").textContent())!;

  await open(page, "/admin/classes");
  await page.getByRole("combobox", { name: "Academic Year" }).selectOption({ label: "2071-2072" });
  await page.getByRole("combobox", { name: "Grade", exact: true }).selectOption({ label: "Grade 5" });
  await page.getByLabel("Class name").fill("5-R");
  await page.getByRole("combobox", { name: "Class Teacher" }).selectOption({ label: "Rana Cards" });
  await page.getByRole("button", { name: "Add Class" }).click();
  await page.getByRole("link", { name: "5-R" }).click();
  await expect(page.getByRole("button", { name: "Add Class Subject" })).toBeVisible();
  await settled(page);
  await page.getByRole("combobox", { name: "Subject", exact: true }).selectOption({ label: "Literature" });
  await page.getByRole("combobox", { name: "Subject Teacher", exact: true }).selectOption({ label: "Rana Cards" });
  await page.getByRole("button", { name: "Add Class Subject" }).click();
  await expect(page.getByRole("combobox", { name: "Subject Teacher of Literature" })).toHaveValue(/.+/);

  await registerStudent(page, "Salma Cards", "E2E-1001");
  await registerStudent(page, "Tariq Cards", "E2E-1002");

  // Rana enters both Students' Marks and writes Salma's remarks.
  await page.context().clearCookies();
  await logIn(page, "rana.cards@school.test", ranaPassword);
  await settled(page);
  await page.getByLabel("Current password").fill(ranaPassword);
  await page.getByLabel("New password", { exact: true }).fill("rana's own password");
  await page.getByLabel("Confirm new password").fill("rana's own password");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page).toHaveURL(/\/teacher$/);

  await open(page, "/teacher");
  await page.getByRole("region", { name: "My Class Subjects" }).getByRole("link", { name: "Literature for 5-R" }).click();
  const create = page.getByRole("region", { name: "New Assessment" });
  await expect(create).toBeVisible();
  await settled(page);
  await create.getByRole("combobox", { name: "Type" }).selectOption({ label: "Quiz" });
  await create.getByLabel("Date").fill("2071-10-10");
  await create.getByLabel("Maximum marks").fill("10");
  await create.getByLabel("Weight").fill("1");
  await create.getByRole("button", { name: "Create Assessment" }).click();
  await expect(page.getByRole("heading", { name: "Quiz on 2071-10-10" })).toBeVisible();
  await settled(page);
  const grid = page.getByRole("region", { name: "Marks", exact: true });
  await grid.getByLabel("Mark for Salma Cards").fill("9");
  await grid.getByLabel("Mark for Tariq Cards").fill("6");
  await grid.getByRole("button", { name: "Save Marks" }).click();
  await expect(grid.getByRole("status").filter({ hasText: "Marks saved." })).toBeVisible();

  await open(page, "/teacher");
  await page.getByRole("region", { name: "My Class Subjects" }).getByRole("link", { name: "Literature for 5-R" }).click();
  await page.getByRole("link", { name: "Write remarks" }).click();
  await expect(page.getByRole("heading", { name: "Remarks: Literature for 5-R" })).toBeVisible();
  await settled(page);
  const salmaSubject = page.getByRole("region", { name: "Salma Cards (E2E-1001)" });
  await expect(salmaSubject.getByText("90%")).toBeVisible();
  await salmaSubject.getByLabel("Remark for Salma Cards").fill("Reads widely.");
  await salmaSubject.getByRole("button", { name: "Save remark" }).click();
  await expect(salmaSubject.getByRole("status").filter({ hasText: "Remark saved." })).toBeVisible();
  await expectNoSidewaysScroll(page);
  // Saved means saved: it's there after a reload.
  await page.reload();
  await expect(page.getByRole("region", { name: "Salma Cards (E2E-1001)" }).getByLabel("Remark for Salma Cards")).toHaveValue(
    "Reads widely.",
  );

  await open(page, "/teacher");
  await page.getByRole("region", { name: "My Classes" }).getByRole("link", { name: "5-R" }).click();
  await page.getByRole("link", { name: "Write overall remarks" }).click();
  await expect(page.getByRole("heading", { name: "Overall remarks: 5-R" })).toBeVisible();
  await settled(page);
  const salmaOverall = page.getByRole("region", { name: "Salma Cards (E2E-1001)" });
  await expect(salmaOverall.getByText("Overall: 90%")).toBeVisible();
  await salmaOverall.getByLabel("Overall remark for Salma Cards").fill("A very good Term.");
  await salmaOverall.getByRole("button", { name: "Save remark" }).click();
  await expect(salmaOverall.getByRole("status").filter({ hasText: "Remark saved." })).toBeVisible();
  await expectNoSidewaysScroll(page);

  // The Admin's preview: Salma's card is complete and Tariq's says what's missing.
  await page.context().clearCookies();
  await logIn(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!);
  await expect(page).toHaveURL(/\/admin$/);
  await open(page, "/admin");
  await page.getByRole("link", { name: "Report Cards" }).click();
  await expect(page.getByRole("heading", { name: "Report Cards", exact: true })).toBeVisible();
  await settled(page);
  await page.getByRole("link", { name: "5-R" }).click();
  await expect(page.getByRole("heading", { name: "Report Cards: 5-R" })).toBeVisible();
  await expect(page.getByText("1 of 2 Report Cards have something missing.")).toBeVisible();

  const salma = page.getByRole("region", { name: "Salma Cards (E2E-1001)" });
  await expect(salma.getByText("Overall: 90%")).toBeVisible();
  await expect(salma.getByText("Rana Cards: Reads widely.")).toBeVisible();
  await expect(salma.getByText("Rana Cards: A very good Term.")).toBeVisible();
  await expect(salma.getByRole("list", { name: "Missing" })).toHaveCount(0);

  const tariq = page.getByRole("region", { name: "Tariq Cards (E2E-1002)" });
  await expect(tariq.getByText("Overall: 60%")).toBeVisible();
  const missing = tariq.getByRole("list", { name: "Missing" });
  await expect(missing.getByText("Literature: remark from Rana Cards")).toBeVisible();
  await expect(missing.getByText("Overall remark from Rana Cards")).toBeVisible();
  await expectNoSidewaysScroll(page);

  // Rank is off until it's switched on.
  await expect(page.getByText(/^Rank:/)).toHaveCount(0);
  await open(page, "/admin/report-cards");
  const rank = page.getByRole("region", { name: "Rank", exact: true });
  await rank.getByLabel("Show rank on Report Cards").check();
  await rank.getByRole("button", { name: "Save" }).click();
  await expect(rank.getByText("Rank is on for the whole school.")).toBeVisible();
  await page.getByRole("link", { name: "5-R" }).click();
  await expect(page.getByRole("heading", { name: "Report Cards: 5-R" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Salma Cards (E2E-1001)" }).getByText("Rank: 1")).toBeVisible();
  await expect(page.getByRole("region", { name: "Tariq Cards (E2E-1002)" }).getByText("Rank: 2")).toBeVisible();

  // Teachers can't reach the preview.
  const previewUrl = page.url();
  await page.context().clearCookies();
  await logIn(page, "rana.cards@school.test", "rana's own password");
  await expect(page).toHaveURL(/\/teacher$/);
  await open(page, previewUrl);
  await expect(page.getByText("You don't have access to this page.")).toBeVisible();
});

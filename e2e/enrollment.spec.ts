import { expect, test, type Page } from "@playwright/test";

// Names and dates here are unique to this spec: e2e specs share one database and run
// in parallel. The year is in the future so it can't overlap another spec's year;
// rosters are therefore checked on chosen dates rather than today.
async function logIn(page: Page, identifier: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email, phone or Student Number").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

test("an Admin enrolls a Student and moves them; rosters and the Enrollment history follow", async ({ page }) => {
  await logIn(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!);
  await expect(page).toHaveURL(/\/admin$/);

  // Setup: a year, a Grade, a Teacher, two Classes and a Student.
  await page.goto("/admin/academic-years");
  await page.getByLabel("Academic Year name").fill("2041-2042");
  await page.getByLabel("First day", { exact: true }).fill("2041-09-01");
  await page.getByLabel("Last day", { exact: true }).fill("2042-06-30");
  await page.getByLabel("Term 1 name").fill("Whole year");
  await page.getByLabel("Term 1 first day").fill("2041-09-01");
  await page.getByLabel("Term 1 last day").fill("2042-06-30");
  await page.getByRole("button", { name: "Create Academic Year" }).click();
  await expect(page.getByRole("heading", { name: /2041-2042/ })).toBeVisible();

  await page.goto("/admin/grades");
  await page.getByLabel("Grade name").first().fill("Grade 9");
  await page.getByRole("button", { name: "Add" }).click();
  // The create form clears itself once saved (the list's order depends on other specs' Grades).
  await expect(page.getByLabel("Grade name").first()).toHaveValue("");

  await page.goto("/admin/teachers");
  await page.getByLabel("Name").fill("Nadia Enrol");
  await page.getByLabel("Email").fill("nadia@school.test");
  await page.getByRole("button", { name: "Add Teacher" }).click();
  const initialPassword = (await page.getByRole("status").locator("code").textContent())!;

  await page.goto("/admin/classes");
  await page.waitForLoadState("networkidle"); // a <select> chosen before hydration is reset
  for (const name of ["9-A", "9-B"]) {
    await page.getByRole("combobox", { name: "Academic Year" }).selectOption({ label: "2041-2042" });
    await page.getByRole("combobox", { name: "Grade", exact: true }).selectOption({ label: "Grade 9" });
    await page.getByLabel("Class name").fill(name);
    await page.getByRole("combobox", { name: "Class Teacher" }).selectOption({ label: "Nadia Enrol" });
    await page.getByRole("button", { name: "Add Class" }).click();
    await expect(page.getByRole("link", { name })).toBeVisible();
  }

  await page.goto("/admin/students");
  await page.getByLabel("Name").fill("Yousef Enrol");
  await page.getByLabel("Student Number").fill("E2E-4096");
  await page.getByLabel("Date of birth").fill("2027-03-03");
  await page.getByLabel("National ID").fill("784-2027-4096");
  await page.getByLabel("Guardian contact").fill("Guardian");
  await page.getByLabel("Admission date").fill("2041-08-25");
  await page.getByRole("button", { name: "Register Student" }).click();
  await expect(page.getByRole("status").filter({ hasText: "E2E-4096" })).toBeVisible();

  // Enroll in 9-A, then move to 9-B.
  await page.getByRole("listitem").filter({ hasText: "Yousef Enrol" }).getByRole("link", { name: "Profile" }).click();
  const history = page.getByRole("list", { name: "Enrollment history" });
  await expect(page.getByText("Not enrolled in any Class yet.")).toBeVisible();
  await page.getByRole("combobox", { name: "Class" }).selectOption({ label: "9-A (Grade 9, 2041-2042)" });
  await page.getByLabel("From").fill("2041-09-01");
  await page.getByRole("button", { name: "Enroll" }).click();
  await expect(history.getByText("From 2041-09-01 · Current")).toBeVisible();

  await expect(page.getByRole("heading", { name: "Move to another Class" })).toBeVisible();
  await page.getByRole("combobox", { name: "Class" }).selectOption({ label: "9-B (Grade 9, 2041-2042)" });
  await page.getByLabel("From").fill("2041-08-01");
  await page.getByRole("button", { name: "Move" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "The move date must be after" })).toBeVisible();
  await page.getByRole("combobox", { name: "Class" }).selectOption({ label: "9-B (Grade 9, 2041-2042)" });
  await page.getByLabel("From").fill("2041-10-06");
  await page.getByRole("button", { name: "Move" }).click();
  await expect(history.getByText("2041-09-01 to 2041-10-05")).toBeVisible();
  await expect(history.getByText("From 2041-10-06 · Current")).toBeVisible();

  // 9-A's roster has him up to the day before the move.
  await page.goto("/admin/classes");
  await page.getByRole("link", { name: "9-A" }).click();
  const roster = page.getByRole("region", { name: "Students" });
  await roster.getByLabel("Students on").fill("2041-10-05");
  await roster.getByRole("button", { name: "Show" }).click();
  await expect(roster.getByRole("link", { name: "Yousef Enrol (E2E-4096)" })).toBeVisible();
  await roster.getByLabel("Students on").fill("2041-10-06");
  await roster.getByRole("button", { name: "Show" }).click();
  await expect(roster.getByText("No Students are enrolled on this date.")).toBeVisible();

  // The Class Teacher sees 9-B's roster, and has a My Students page.
  await page.context().clearCookies();
  await logIn(page, "nadia@school.test", initialPassword);
  await page.getByLabel("Current password").fill(initialPassword);
  await page.getByLabel("New password", { exact: true }).fill("nadia's own password");
  await page.getByLabel("Confirm new password").fill("nadia's own password");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page).toHaveURL(/\/teacher$/);

  await page.getByRole("region", { name: "My Classes" }).getByRole("link", { name: "9-B" }).click();
  await expect(page.getByRole("heading", { name: "9-B" })).toBeVisible();
  const teacherRoster = page.getByRole("region", { name: "Students" });
  await teacherRoster.getByLabel("Students on").fill("2041-10-06");
  await teacherRoster.getByRole("button", { name: "Show" }).click();
  await expect(teacherRoster.getByRole("link", { name: "Yousef Enrol (E2E-4096)" })).toBeVisible();

  await page.goto("/teacher");
  await page.getByRole("link", { name: "My Students" }).click();
  await expect(page.getByRole("heading", { name: "My Students" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Class", exact: true })).toBeVisible();
});

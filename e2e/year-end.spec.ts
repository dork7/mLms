import { expect, test, type Page } from "@playwright/test";

// This spec owns years 2095-2096 and 2096-2097, Grades 21 and 22, and these names:
// e2e specs share one database and run in parallel.
async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle"); // a <select> chosen before hydration is reset
}

async function addYear(page: Page, name: string, start: string, end: string) {
  await open(page, "/admin/academic-years");
  await page.getByLabel("Academic Year name").fill(name);
  await page.getByLabel("First day", { exact: true }).fill(start);
  await page.getByLabel("Last day", { exact: true }).fill(end);
  await page.getByLabel("Term 1 name").fill("Whole year");
  await page.getByLabel("Term 1 first day").fill(start);
  await page.getByLabel("Term 1 last day").fill(end);
  await page.getByRole("button", { name: "Create Academic Year" }).click();
  await expect(page.getByRole("heading", { name: new RegExp(name) })).toBeVisible();
}

async function addGrade(page: Page, name: string) {
  await open(page, "/admin/grades");
  await page.getByLabel("Grade name").first().fill(name);
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByLabel("Grade name").first()).toHaveValue("");
}

async function addClass(page: Page, year: string, grade: string, name: string) {
  await open(page, "/admin/classes");
  await page.getByRole("combobox", { name: "Academic Year" }).selectOption({ label: year });
  await page.getByRole("combobox", { name: "Grade", exact: true }).selectOption({ label: grade });
  await page.getByLabel("Class name").fill(name);
  await page.getByRole("combobox", { name: "Class Teacher" }).selectOption({ label: "Tariq Yearend" });
  await page.getByRole("button", { name: "Add Class" }).click();
  await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
}

async function addStudent(page: Page, name: string, studentNumber: string, classLabel: string, start: string) {
  await open(page, "/admin/students");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Student Number").fill(studentNumber);
  await page.getByLabel("Date of birth").fill("2080-03-03");
  await page.getByLabel("National ID").fill(`784-${studentNumber}`);
  await page.getByLabel("Guardian contact").fill("Guardian");
  await page.getByLabel("Admission date").fill(start);
  await page.getByRole("button", { name: "Register Student" }).click();
  await expect(page.getByRole("status").filter({ hasText: studentNumber })).toBeVisible();
  await page.getByRole("listitem").filter({ hasText: name }).getByRole("link", { name: "Profile" }).click();
  await expect(page.getByText("Not enrolled in any Class yet.")).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.getByRole("combobox", { name: "Class" }).selectOption({ label: classLabel });
  await page.getByLabel("From").fill(start);
  await page.getByRole("button", { name: "Enroll" }).click();
  await expect(page.getByText(`From ${start} · Current`)).toBeVisible();
}

test("an Admin promotes a Class with Repeating and Leaving Students, then Closes the year", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email, phone or Student Number").fill(process.env.E2E_ADMIN_EMAIL!);
  await page.getByLabel("Password").fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  await addYear(page, "2095-2096", "2095-09-01", "2096-06-30");
  await addYear(page, "2096-2097", "2096-09-01", "2097-06-30");
  await addGrade(page, "Grade 21");
  await addGrade(page, "Grade 22");
  await open(page, "/admin/teachers");
  await page.getByLabel("Name").fill("Tariq Yearend");
  await page.getByLabel("Email").fill("tariq.yearend@school.test");
  await page.getByRole("button", { name: "Add Teacher" }).click();
  await expect(page.getByRole("status").locator("code")).toBeVisible();

  await addClass(page, "2095-2096", "Grade 21", "21-A");
  await addClass(page, "2096-2097", "Grade 21", "21-R");
  await addClass(page, "2096-2097", "Grade 22", "22-A");
  const start = "2095-09-01";
  await addStudent(page, "Promoted Pat", "YE-1", "21-A (Grade 21, 2095-2096)", start);
  await addStudent(page, "Repeating Rana", "YE-2", "21-A (Grade 21, 2095-2096)", start);
  await addStudent(page, "Leaving Layla", "YE-3", "21-A (Grade 21, 2095-2096)", start);

  // The year can't be Closed yet, and says why.
  await open(page, "/admin");
  await page.getByRole("link", { name: "Year end" }).click();
  const year = page.getByRole("region", { name: "2095-2096" });
  await expect(year.getByText("3 waiting for Promotion")).toBeVisible();
  await expect(year.getByRole("button", { name: "Close 2095-2096" })).toHaveCount(0);

  await year.getByRole("link", { name: "Promote 21-A" }).click();
  await expect(page.getByRole("heading", { name: "Promote 21-A" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.getByRole("combobox", { name: "Promote into" }).selectOption({ label: "22-A" });
  await page.getByRole("group", { name: "Repeating Rana" }).getByLabel("Repeating").check();
  await page.getByRole("combobox", { name: "New Class for Repeating Rana" }).selectOption({ label: "21-R" });
  await page.getByRole("group", { name: "Leaving Layla" }).getByLabel("Leaving").check();
  await page.getByLabel("Last day for Leaving Layla").fill("2096-03-15");
  await page.getByRole("button", { name: "Promote Class" }).click();

  // Back on year end, nobody is waiting, and the Admin Closes the year.
  await expect(page).toHaveURL(/\/admin\/year-end$/);
  await expect(year.getByText("Nobody waiting")).toBeVisible();
  await page.waitForLoadState("networkidle");
  await year.getByLabel("I understand that 2095-2096 can't be reopened").check();
  await year.getByRole("button", { name: "Close 2095-2096" }).click();
  await expect(year.getByText("· Closed")).toBeVisible();
  await expect(year.getByRole("button", { name: "Close 2095-2096" })).toHaveCount(0);

  // The Closed year stays viewable, with its rosters, but offers no way to change it.
  await year.getByRole("link", { name: "View 21-A" }).click();
  await expect(page.getByRole("heading", { name: "21-A" })).toBeVisible();
  await expect(page.getByText("This Academic Year is Closed.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add Class Subject" })).toHaveCount(0);
  const roster = page.getByRole("region", { name: "Students" });
  await roster.getByLabel("Students on").fill("2096-03-15");
  await roster.getByRole("button", { name: "Show" }).click();
  await expect(roster.getByRole("link", { name: /Leaving Layla/ })).toBeVisible();
  await roster.getByLabel("Students on").fill("2096-03-16");
  await roster.getByRole("button", { name: "Show" }).click();
  await expect(roster.getByRole("link", { name: /Leaving Layla/ })).toHaveCount(0);
  await expect(roster.getByRole("link", { name: /Promoted Pat/ })).toBeVisible();

  // The new year's rosters follow the choices made.
  await open(page, "/admin/classes");
  await page.getByRole("link", { name: "22-A", exact: true }).click();
  const next = page.getByRole("region", { name: "Students" });
  await next.getByLabel("Students on").fill("2096-09-01");
  await next.getByRole("button", { name: "Show" }).click();
  await expect(next.getByRole("link", { name: /Promoted Pat/ })).toBeVisible();
  await expect(next.getByRole("link", { name: /Repeating Rana/ })).toHaveCount(0);
  await expect(next.getByRole("link", { name: /Leaving Layla/ })).toHaveCount(0);

  await open(page, "/admin/classes");
  await page.getByRole("link", { name: "21-R", exact: true }).click();
  const repeat = page.getByRole("region", { name: "Students" });
  await repeat.getByLabel("Students on").fill("2096-09-01");
  await repeat.getByRole("button", { name: "Show" }).click();
  await expect(repeat.getByRole("link", { name: /Repeating Rana/ })).toBeVisible();
});

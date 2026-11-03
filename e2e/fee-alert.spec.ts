import { expect, test, type Page } from "@playwright/test";

// Names, numbers and dates here are unique to this spec: e2e specs share one database and
// run in parallel. This spec owns year 2131-2132, Grade 51, Class 51-A, the Teacher Rania
// Alert, the Student ALERT-2001 and the Fee "Fee Alert Spec Tuition". The dev server uses
// the real Clock, so the Fee is due in the past and is Overdue from the start.
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

const feeAlert = (page: Page) => page.getByRole("alert").filter({ hasText: "Fee Alert" });

test("the Admin and the Student see the Fee Alert for an Overdue Fee, and a Teacher never does", async ({ page }) => {
  await logInAsAdmin(page);

  await open(page, "/admin/academic-years");
  await page.getByLabel("Academic Year name").fill("2131-2132");
  await page.getByLabel("First day", { exact: true }).fill("2131-09-01");
  await page.getByLabel("Last day", { exact: true }).fill("2132-06-30");
  await page.getByLabel("Term 1 name").fill("Whole of 2131");
  await page.getByLabel("Term 1 first day").fill("2131-09-01");
  await page.getByLabel("Term 1 last day").fill("2132-06-30");
  await page.getByRole("button", { name: "Create Academic Year" }).click();
  await expect(page.getByRole("heading", { name: /2131-2132/ })).toBeVisible();

  await open(page, "/admin/grades");
  await page.getByLabel("Grade name").first().fill("Grade 51");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.locator('input[name="name"][value="Grade 51"]')).toBeVisible();

  await open(page, "/admin/teachers");
  await page.getByLabel("Name").fill("Rania Alert");
  await page.getByLabel("Email").fill("rania.alert@school.test");
  await page.getByRole("button", { name: "Add Teacher" }).click();
  const raniaInitial = (await page.getByRole("status").filter({ hasText: "Rania Alert" }).locator("code").textContent())!;

  await open(page, "/admin/classes");
  await page.getByRole("combobox", { name: "Academic Year" }).selectOption({ label: "2131-2132" });
  await page.getByRole("combobox", { name: "Grade", exact: true }).selectOption({ label: "Grade 51" });
  await page.getByLabel("Class name").fill("51-A");
  await page.getByRole("combobox", { name: "Class Teacher" }).selectOption({ label: "Rania Alert" });
  await page.getByRole("button", { name: "Add Class" }).click();
  await expect(page.getByRole("link", { name: "51-A" })).toBeVisible();
  const classPath = new URL((await page.getByRole("link", { name: "51-A" }).getAttribute("href"))!, page.url()).pathname;

  // Register Hana and enroll her in 51-A, the Class Rania teaches.
  await open(page, "/admin/students");
  await page.getByLabel("Name").fill("Hana Alert");
  await page.getByLabel("Student Number").fill("ALERT-2001");
  await page.getByLabel("Date of birth").fill("2120-03-03");
  await page.getByLabel("National ID").fill("784-ALERT-2001");
  await page.getByLabel("Guardian contact").fill("Guardian");
  await page.getByLabel("Admission date").fill("2131-08-25");
  await page.getByRole("button", { name: "Register Student" }).click();
  const registered = page.getByRole("status").filter({ hasText: "ALERT-2001" });
  await expect(registered).toBeVisible();
  const hanaInitial = (await registered.locator("code").textContent())!;
  await page.getByRole("listitem").filter({ hasText: "Hana Alert" }).getByRole("link", { name: "Profile" }).click();
  await expect(page.getByRole("combobox", { name: "Class" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  const profilePath = new URL(page.url()).pathname;
  const hanaId = profilePath.split("/").pop()!;
  await page.getByRole("combobox", { name: "Class" }).selectOption({ label: "51-A (Grade 51, 2131-2132)" });
  await page.getByLabel("From").fill("2131-09-01");
  await page.getByRole("button", { name: "Enroll" }).click();
  await expect(page.getByText("From 2131-09-01 · Current")).toBeVisible();
  await expect(feeAlert(page)).toHaveCount(0);

  // A Fee due long ago, owed by Hana alone: Overdue at once.
  await open(page, "/admin/fees");
  await page.getByLabel("Name").fill("Fee Alert Spec Tuition");
  await page.getByLabel("Amount (AED)").fill("2,000");
  await page.getByLabel("Due date").fill("2020-01-15");
  await page.getByRole("button", { name: "Define Fee" }).click();
  await page.getByRole("link", { name: "Fee Alert Spec Tuition" }).click();
  await expect(page.getByRole("heading", { name: "Fee Alert Spec Tuition" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Hana Alert (ALERT-2001)").check();
  await page.getByRole("button", { name: "Apply" }).last().click();
  await expect(page.getByRole("status").filter({ hasText: "New Fee Assignments: 1." })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Fee Assignments" }).getByRole("listitem").filter({ hasText: "Hana Alert" }),
  ).toContainText("Unpaid · Overdue");

  // The Admin sees the alert on her profile and on her Class's Report Card screen.
  await open(page, profilePath);
  await expect(feeAlert(page)).toContainText("Hana Alert has an Overdue Fee.");
  await expect(feeAlert(page)).toContainText("Fee Alert Spec Tuition: due 2020-01-15, AED 0.00 paid of AED 2,000.00");
  await expect(page.getByRole("region", { name: "Fees", exact: true }).getByText("Overdue")).toBeVisible();
  await open(page, `${classPath}/report-cards`);
  await expect(page.getByRole("region", { name: /Hana Alert/ }).getByRole("alert")).toContainText("Fee Alert");

  // Hana sees it on her dashboard, her profile and her Report Card screen.
  await logInFirstTime(page, "ALERT-2001", hanaInitial, /\/student$/);
  await expect(feeAlert(page)).toContainText("You have an Overdue Fee.");
  await page.getByRole("link", { name: "My profile" }).click();
  await expect(page.getByRole("heading", { name: "My profile" })).toBeVisible();
  await expect(feeAlert(page)).toContainText("Fee Alert Spec Tuition");
  await open(page, "/student/report-cards");
  await expect(feeAlert(page)).toBeVisible();
  await feeAlert(page).getByRole("link", { name: "See My Fees" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Fee Alert Spec Tuition" })).toContainText("Unpaid · Overdue");

  // Her Class Teacher sees her, but never the Fee Alert.
  await logInFirstTime(page, "rania.alert@school.test", raniaInitial, /\/teacher$/);
  await open(page, `/teacher/students/${hanaId}/marks`);
  await expect(page.getByRole("heading", { name: "Assessment history" }).first()).toBeVisible();
  await expect(page.getByText("Fee Alert")).toHaveCount(0);
  await open(page, "/teacher");
  await page.getByRole("link", { name: "51-A" }).first().click();
  await expect(page.getByRole("heading", { name: "51-A" })).toBeVisible();
  await expect(page.getByText("Fee Alert")).toHaveCount(0);
  await expect(page.getByText("Overdue")).toHaveCount(0);
});

import { expect, test, type Page } from "@playwright/test";

// Names, numbers and dates here are unique to this spec: e2e specs share one database and
// run in parallel. This spec owns year 2121-2122, Grade 41, Class 41-F, the Teacher Tariq
// Fees, the Students FEE-1801 and FEE-1802, and the Fees named "Fees Spec ...". An open
// Enrollment that hasn't ended counts as being in the Grade, so a future year works. The dev
// server uses the real clock, so Payment Records are dated in the past.
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

async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

async function registerAndEnroll(page: Page, name: string, studentNumber: string): Promise<string> {
  await open(page, "/admin/students");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Student Number").fill(studentNumber);
  await page.getByLabel("Date of birth").fill("2110-03-03");
  await page.getByLabel("National ID").fill(`784-${studentNumber}`);
  await page.getByLabel("Guardian contact").fill("Guardian");
  await page.getByLabel("Admission date").fill("2121-08-25");
  await page.getByRole("button", { name: "Register Student" }).click();
  const status = page.getByRole("status").filter({ hasText: studentNumber });
  await expect(status).toBeVisible();
  const initial = (await status.locator("code").textContent())!;
  await page.getByRole("listitem").filter({ hasText: name }).getByRole("link", { name: "Profile" }).click();
  await expect(page.getByRole("combobox", { name: "Class" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.getByRole("combobox", { name: "Class" }).selectOption({ label: "41-F (Grade 41, 2121-2122)" });
  await page.getByLabel("From").fill("2121-09-01");
  await page.getByRole("button", { name: "Enroll" }).click();
  await expect(page.getByText("From 2121-09-01 · Current")).toBeVisible();
  return initial;
}

async function logPayment(page: Page, amount: string, method: string, reference: string) {
  const form = page.getByRole("region", { name: "Log a Payment Record" });
  await form.getByLabel("Amount (AED)").fill(amount);
  await form.getByLabel("Date").fill("2025-01-15");
  await form.getByRole("combobox", { name: "Method" }).selectOption({ label: method });
  await form.getByLabel("Reference").fill(reference);
  await form.getByRole("button", { name: "Log Payment Record" }).click();
  await expect(page.getByRole("region", { name: "Payment Records" }).getByText(reference)).toBeVisible();
}

test("the Admin defines and applies Fees and logs Payment Records, and the Student sees their own", async ({ page }) => {
  await logInAsAdmin(page);

  await open(page, "/admin/academic-years");
  await page.getByLabel("Academic Year name").fill("2121-2122");
  await page.getByLabel("First day", { exact: true }).fill("2121-09-01");
  await page.getByLabel("Last day", { exact: true }).fill("2122-06-30");
  await page.getByLabel("Term 1 name").fill("Whole of 2121");
  await page.getByLabel("Term 1 first day").fill("2121-09-01");
  await page.getByLabel("Term 1 last day").fill("2122-06-30");
  await page.getByRole("button", { name: "Create Academic Year" }).click();
  await expect(page.getByRole("heading", { name: /2121-2122/ })).toBeVisible();

  await open(page, "/admin/grades");
  await page.getByLabel("Grade name").first().fill("Grade 41");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.locator('input[name="name"][value="Grade 41"]')).toBeVisible();

  await open(page, "/admin/teachers");
  await page.getByLabel("Name").fill("Tariq Fees");
  await page.getByLabel("Email").fill("tariq.fees@school.test");
  await page.getByRole("button", { name: "Add Teacher" }).click();
  const tariqStatus = page.getByRole("status").filter({ hasText: "Tariq Fees" });
  const tariqInitial = (await tariqStatus.locator("code").textContent())!;

  await open(page, "/admin/classes");
  await page.getByRole("combobox", { name: "Academic Year" }).selectOption({ label: "2121-2122" });
  await page.getByRole("combobox", { name: "Grade", exact: true }).selectOption({ label: "Grade 41" });
  await page.getByLabel("Class name").fill("41-F");
  await page.getByRole("combobox", { name: "Class Teacher" }).selectOption({ label: "Tariq Fees" });
  await page.getByRole("button", { name: "Add Class" }).click();
  await expect(page.getByRole("link", { name: "41-F" })).toBeVisible();

  const farahInitial = await registerAndEnroll(page, "Farah Fees", "FEE-1801");
  await registerAndEnroll(page, "Ghazi Fees", "FEE-1802");

  // Define two Fees from the dashboard's link.
  await open(page, "/admin");
  await page.getByRole("link", { name: "Fees", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Fees", exact: true })).toBeVisible();
  await page.waitForLoadState("networkidle");
  for (const [name, amount] of [
    ["Fees Spec Tuition", "4,500.50"],
    ["Fees Spec Bus", "300"],
  ]) {
    await page.getByLabel("Name").fill(name);
    await page.getByLabel("Amount (AED)").fill(amount);
    await page.getByLabel("Due date").fill("2121-10-01");
    await page.getByRole("button", { name: "Define Fee" }).click();
    await expect(page.getByRole("link", { name })).toBeVisible();
  }
  await expect(page.getByRole("listitem").filter({ hasText: "Fees Spec Tuition" }).getByText("AED 4,500.50")).toBeVisible();
  await expectNoSidewaysScroll(page);

  // Tuition goes to the whole Grade.
  await page.getByRole("link", { name: "Fees Spec Tuition" }).click();
  await expect(page.getByRole("heading", { name: "Fees Spec Tuition" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.getByRole("combobox", { name: "Grade", exact: true }).selectOption({ label: "Grade 41" });
  await page.getByRole("button", { name: "Apply" }).first().click();
  await expect(page.getByRole("status").filter({ hasText: "New Fee Assignments: 2." })).toBeVisible();
  const assignments = page.getByRole("region", { name: "Fee Assignments" });
  for (const name of ["Farah Fees", "Ghazi Fees"]) {
    await expect(assignments.getByRole("listitem").filter({ hasText: name }).getByText("Unpaid")).toBeVisible();
  }
  await expectNoSidewaysScroll(page);

  // Farah pays in two parts, and Ghazi's is waived.
  await assignments.getByRole("link", { name: "Farah Fees" }).click();
  await expect(page.getByRole("heading", { name: "Fees Spec Tuition: Farah Fees" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await logPayment(page, "1,000", "Cash", "R-1801");
  await expect(page.getByText("Partially Paid")).toBeVisible();
  await logPayment(page, "3500.50", "Bank transfer", "TRX-1801");
  await expect(page.getByText("Paid", { exact: true })).toBeVisible();
  await expectNoSidewaysScroll(page);

  await page.getByRole("link", { name: "Back to Fees Spec Tuition" }).click();
  await page.getByRole("region", { name: "Fee Assignments" }).getByRole("link", { name: "Ghazi Fees" }).click();
  await expect(page.getByRole("heading", { name: "Fees Spec Tuition: Ghazi Fees" })).toBeVisible();
  await page.getByRole("button", { name: "Waive" }).click();
  await expect(page.getByRole("button", { name: "Undo waiver" })).toBeVisible();
  await expect(page.getByText("Waived", { exact: true })).toBeVisible();

  // The Bus Fee goes to Farah alone.
  await open(page, "/admin/fees");
  await page.getByRole("link", { name: "Fees Spec Bus" }).click();
  await expect(page.getByRole("heading", { name: "Fees Spec Bus" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Farah Fees (FEE-1801)").check();
  await page.getByRole("button", { name: "Apply" }).last().click();
  await expect(page.getByRole("status").filter({ hasText: "New Fee Assignments: 1." })).toBeVisible();
  await expect(page.getByRole("region", { name: "Fee Assignments" }).getByRole("listitem")).toHaveCount(1);

  // Farah sees her own Fees and Payment Records.
  await logInFirstTime(page, "FEE-1801", farahInitial, /\/student$/);
  await page.getByRole("link", { name: "My Fees" }).click();
  await expect(page.getByRole("heading", { name: "My Fees" })).toBeVisible();
  const tuition = page.getByRole("listitem").filter({ hasText: "Fees Spec Tuition" });
  await expect(tuition.getByText("Paid", { exact: true })).toBeVisible();
  await expect(tuition.getByText("AED 4,500.50 paid of AED 4,500.50")).toBeVisible();
  await expect(tuition.getByText("AED 1,000.00 on 2025-01-15 · Cash · R-1801")).toBeVisible();
  await expect(tuition.getByText("AED 3,500.50 on 2025-01-15 · Bank transfer · TRX-1801")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Fees Spec Bus" }).getByText("Unpaid")).toBeVisible();
  await expectNoSidewaysScroll(page);

  // Her Class Teacher sees no Fee data.
  await logInFirstTime(page, "tariq.fees@school.test", tariqInitial, /\/teacher$/);
  await open(page, "/admin/fees");
  await expect(page.getByText("You don't have access to this page.")).toBeVisible();
  await expect(page.getByText("Fees Spec Tuition")).toHaveCount(0);
});

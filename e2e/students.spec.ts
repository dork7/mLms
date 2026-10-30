import { expect, test, type Page } from "@playwright/test";

// A real 1x1 PNG, so the browser can decode the uploaded photo.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

async function logIn(page: Page, identifier: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email, phone or Student Number").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

async function changePassword(page: Page, current: string, next: string) {
  await expect(page).toHaveURL(/\/change-password$/);
  await page.getByLabel("Current password").fill(current);
  await page.getByLabel("New password", { exact: true }).fill(next);
  await page.getByLabel("Confirm new password").fill(next);
  await page.getByRole("button", { name: "Change password" }).click();
}

test("an Admin registers a Student with a photo; the Student logs in by Student Number and sees their profile", async ({
  page,
}) => {
  await logIn(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole("link", { name: "Students" }).click();

  await page.getByLabel("Name").fill("Aisha Rahman");
  await page.getByLabel("Student Number").fill("e2e-1024");
  await page.getByLabel("Date of birth").fill("2013-04-12");
  await page.getByLabel("National ID").fill("784-2013-1234567-1");
  await page.getByLabel("Guardian contact").fill("Fatima Rahman, +971 50 765 4321");
  await page.getByLabel("Admission date").fill("2026-08-25");
  await page.getByLabel(/^Photo/).setInputFiles({ name: "aisha.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "Register Student" }).click();
  const status = page.getByRole("status").filter({ hasText: "E2E-1024" });
  const initialPassword = (await status.locator("code").textContent())!;

  // The same Student Number again is refused, and the form keeps what was entered.
  await page.getByLabel("Name").fill("Someone Else");
  await page.getByLabel("Student Number").fill("E2E-1024");
  await page.getByLabel("Date of birth").fill("2013-01-01");
  await page.getByLabel("National ID").fill("784-1");
  await page.getByLabel("Guardian contact").fill("Guardian");
  await page.getByLabel("Admission date").fill("2026-08-25");
  await page.getByRole("button", { name: "Register Student" }).click();
  await expect(page.getByText("Another Student already has this Student Number.")).toBeVisible();
  await expect(page.getByLabel("Name")).toHaveValue("Someone Else");

  await page.context().clearCookies();
  await logIn(page, "e2e-1024", initialPassword);
  await changePassword(page, initialPassword, "aisha's own password");

  await expect(page).toHaveURL(/\/student$/);
  await expect(page.getByRole("heading", { name: "My profile" })).toBeVisible();
  await expect(page.getByText("784-2013-1234567-1")).toBeVisible();
  const photo = page.getByRole("img", { name: "Photo of Aisha Rahman" });
  await expect(photo).toHaveJSProperty("naturalWidth", 1);
});

test("an Admin resets a Student's password and disables their login", async ({ page }) => {
  await logIn(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole("link", { name: "Students" }).click();
  await page.getByLabel("Name").fill("Omar Rahman");
  await page.getByLabel("Student Number").fill("E2E-2048");
  await page.getByLabel("Date of birth").fill("2012-02-02");
  await page.getByLabel("National ID").fill("784-2012-7654321-1");
  await page.getByLabel("Guardian contact").fill("Fatima Rahman");
  await page.getByLabel("Admission date").fill("2026-08-25");
  await page.getByRole("button", { name: "Register Student" }).click();
  await expect(page.getByRole("status").filter({ hasText: "E2E-2048" })).toBeVisible();

  await page.getByRole("listitem").filter({ hasText: "Omar Rahman" }).getByRole("link", { name: "Profile" }).click();
  await page.getByRole("button", { name: "Reset password" }).click();
  const newPassword = (await page.getByRole("status").filter({ hasText: "Omar Rahman" }).locator("code").textContent())!;
  await page.getByRole("button", { name: "Disable login" }).click();
  await expect(page.getByText("Login disabled")).toBeVisible();

  await page.context().clearCookies();
  await logIn(page, "E2E-2048", newPassword);
  await expect(page.getByText("Login or password is incorrect.")).toBeVisible();
});

import { expect, test, type Page } from "@playwright/test";

async function logIn(page: Page, identifier: string, password: string) {
  await page.getByLabel("Email or phone").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

test("a seeded Admin logs in through the real UI and sees the Admin dashboard", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);

  await logIn(page, process.env.E2E_ADMIN_EMAIL!, "wrong password");
  await expect(page.getByText("Email, phone or password is incorrect.")).toBeVisible();

  await logIn(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!);

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Admin dashboard" })).toBeVisible();
  await expect(page.getByText("Welcome, E2E Admin.")).toBeVisible();
});

test("an Admin adds a Teacher, who logs in by phone and must change the initial password", async ({
  page,
}) => {
  await page.goto("/login");
  await logIn(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole("link", { name: "Teachers" }).click();

  await page.getByLabel("Name").fill("Huda Teacher");
  await page.getByLabel("Phone").fill("+971 50 999 0001");
  await page.getByRole("button", { name: "Add Teacher" }).click();
  const initialPassword = (await page.getByRole("status").locator("code").textContent())!;
  await expect(page.getByText("Huda Teacher", { exact: true })).toBeVisible();
  await page.context().clearCookies();

  await page.goto("/login");
  await logIn(page, "+971509990001", initialPassword);
  await expect(page).toHaveURL(/\/change-password$/);
  await page.goto("/teacher");
  await expect(page).toHaveURL(/\/change-password$/);

  await page.getByLabel("Current password").fill(initialPassword);
  await page.getByLabel("New password", { exact: true }).fill("huda's own password");
  await page.getByLabel("Confirm new password").fill("huda's own password");
  await page.getByRole("button", { name: "Change password" }).click();

  await expect(page).toHaveURL(/\/teacher$/);
  await expect(page.getByRole("heading", { name: "Teacher dashboard" })).toBeVisible();
});

import { expect, test } from "@playwright/test";

test("an Admin creates an Academic Year with two Terms and sees them listed", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.E2E_ADMIN_EMAIL!);
  await page.getByLabel("Password").fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  await page.getByRole("link", { name: "Academic Years" }).click();
  await expect(page.getByRole("heading", { name: "Academic Years" })).toBeVisible();

  await page.getByLabel("Academic Year name").fill("2026-2027");
  await page.getByLabel("First day", { exact: true }).fill("2026-09-01");
  await page.getByLabel("Last day", { exact: true }).fill("2027-06-30");
  await page.getByLabel("Term 1 name").fill("Term 1");
  await page.getByLabel("Term 1 first day").fill("2026-09-01");
  await page.getByLabel("Term 1 last day").fill("2026-12-20");
  await page.getByRole("button", { name: "Add a Term" }).click();
  await page.getByLabel("Term 2 name").fill("Term 2");
  await page.getByLabel("Term 2 first day").fill("2027-01-01");
  await page.getByLabel("Term 2 last day").fill("2027-06-30");

  // A gap between the Terms is refused, and the entered values stay.
  await page.getByRole("button", { name: "Create Academic Year" }).click();
  // (Next's route announcer is also role="alert", so match on the text.)
  await expect(
    page.getByRole("alert").filter({ hasText: "The Terms must cover the whole Academic Year, with no gaps or overlaps." }),
  ).toBeVisible();
  await expect(page.getByLabel("Term 2 name")).toHaveValue("Term 2");

  await page.getByLabel("Term 1 last day").fill("2026-12-31");
  await page.getByRole("button", { name: "Create Academic Year" }).click();

  await expect(page.getByRole("heading", { name: /2026-2027/ })).toBeVisible();
  await expect(page.getByText("Term 1: 2026-09-01 to 2026-12-31")).toBeVisible();
  await expect(page.getByText("Term 2: 2027-01-01 to 2027-06-30")).toBeVisible();
});

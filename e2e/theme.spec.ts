import { expect, test, type Page } from "@playwright/test";

const LIGHT_BG = "rgb(247, 247, 245)";
const DARK_BG = "rgb(18, 18, 18)";

function pageBackground(page: Page) {
  return page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
}

function themePicker(page: Page) {
  return page.getByRole("combobox", { name: "Theme" });
}

test("with no choice made, the page follows the system colour scheme", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/login");
  await expect(themePicker(page)).toHaveValue("system");
  expect(await pageBackground(page)).toBe(DARK_BG);

  await page.emulateMedia({ colorScheme: "light" });
  expect(await pageBackground(page)).toBe(LIGHT_BG);
});

test("a chosen theme overrides the system and survives a reload, until System is chosen again", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/login");

  await themePicker(page).selectOption({ label: "Dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect.poll(() => pageBackground(page)).toBe(DARK_BG);

  await page.reload();
  await expect(themePicker(page)).toHaveValue("dark");
  expect(await pageBackground(page)).toBe(DARK_BG);

  await themePicker(page).selectOption({ label: "System" });
  await expect(page.locator("html")).not.toHaveAttribute("data-theme");
  await expect.poll(() => pageBackground(page)).toBe(LIGHT_BG);
});

test("a saved theme is applied before the page hydrates", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: true, colorScheme: "light" });
  await context.addInitScript(() => localStorage.setItem("theme", "dark"));
  const page = await context.newPage();
  // Stop the app's own JavaScript: only the inline script in <head> can set the theme.
  await page.route("**/_next/static/**/*.js", (route) => route.abort());

  await page.goto("/login");

  expect(await page.locator("html").getAttribute("data-theme")).toBe("dark");
  expect(await pageBackground(page)).toBe(DARK_BG);
  await context.close();
});

test("printing uses the light scheme and leaves the picker out, even in dark mode", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/login");
  await themePicker(page).selectOption({ label: "Dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.emulateMedia({ media: "print" });

  await expect(themePicker(page)).toBeHidden();
  const text = await page.evaluate(() => getComputedStyle(document.documentElement).color);
  expect(text).toBe("rgb(26, 26, 26)");
});

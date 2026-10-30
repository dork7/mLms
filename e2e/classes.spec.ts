import { expect, test, type Page } from "@playwright/test";

// Names and dates here are unique to this spec: e2e specs share one database.
async function logIn(page: Page, identifier: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email, phone or Student Number").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

test("an Admin creates a Class and a Class Subject, and the Teacher sees them", async ({ page }) => {
  await logIn(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!);
  await expect(page).toHaveURL(/\/admin$/);

  // School setup the Class needs: an Academic Year, a Grade, a Subject and a Teacher.
  await page.goto("/admin/academic-years");
  await page.getByLabel("Academic Year name").fill("2031-2032");
  await page.getByLabel("First day", { exact: true }).fill("2031-09-01");
  await page.getByLabel("Last day", { exact: true }).fill("2032-06-30");
  await page.getByLabel("Term 1 name").fill("Whole year");
  await page.getByLabel("Term 1 first day").fill("2031-09-01");
  await page.getByLabel("Term 1 last day").fill("2032-06-30");
  await page.getByRole("button", { name: "Create Academic Year" }).click();
  await expect(page.getByRole("heading", { name: /2031-2032/ })).toBeVisible();

  await page.goto("/admin/grades");
  await page.getByLabel("Grade name").first().fill("Grade 10");
  await page.getByRole("button", { name: "Add" }).click();
  // The list is sorted and shared with other specs, so find the row by its value.
  await expect(page.locator('input[name="name"][value="Grade 10"]')).toBeVisible();

  await page.goto("/admin/subjects");
  await page.getByLabel("Subject name").first().fill("Physics");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.locator('input[name="name"][value="Physics"]')).toBeVisible();

  await page.goto("/admin/teachers");
  await page.getByLabel("Name").fill("Rania Physics");
  await page.getByLabel("Email").fill("rania@school.test");
  await page.getByRole("button", { name: "Add Teacher" }).click();
  const initialPassword = (await page.getByRole("status").locator("code").textContent())!;

  // The Class, with Rania as its Class Teacher.
  await page.goto("/admin");
  await page.getByRole("link", { name: "Classes" }).click();
  await expect(page.getByRole("heading", { name: "Classes" })).toBeVisible();
  await page.getByRole("combobox", { name: "Academic Year" }).selectOption({ label: "2031-2032" });
  await page.getByRole("combobox", { name: "Grade", exact: true }).selectOption({ label: "Grade 10" });
  await page.getByLabel("Class name").fill("10-A");
  await page.getByRole("combobox", { name: "Class Teacher" }).selectOption({ label: "Rania Physics" });
  await page.getByRole("button", { name: "Add Class" }).click();

  // The Class Subject, with Rania as its Subject Teacher.
  await page.getByRole("link", { name: "10-A" }).click();
  await expect(page.getByRole("heading", { name: "10-A" })).toBeVisible();
  await page.getByRole("combobox", { name: "Subject", exact: true }).selectOption({ label: "Physics" });
  await page.getByRole("combobox", { name: "Subject Teacher", exact: true }).selectOption({ label: "Rania Physics" });
  await page.getByRole("button", { name: "Add Class Subject" }).click();
  await expect(page.getByRole("combobox", { name: "Subject Teacher of Physics" })).toHaveValue(/.+/);

  // Adding the same Subject again is refused.
  await page.getByRole("combobox", { name: "Subject", exact: true }).selectOption({ label: "Physics" });
  await page.getByRole("combobox", { name: "Subject Teacher", exact: true }).selectOption({ label: "Rania Physics" });
  await page.getByRole("button", { name: "Add Class Subject" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "This Class already has that Subject." })).toBeVisible();

  // The Teacher sees her Class Subject and her Class.
  await page.context().clearCookies();
  await logIn(page, "rania@school.test", initialPassword);
  await page.getByLabel("Current password").fill(initialPassword);
  await page.getByLabel("New password", { exact: true }).fill("rania's own password");
  await page.getByLabel("Confirm new password").fill("rania's own password");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page).toHaveURL(/\/teacher$/);

  const mySubjects = page.getByRole("region", { name: "My Class Subjects" });
  await mySubjects.getByRole("link", { name: "Physics for 10-A" }).click();
  await expect(page.getByRole("heading", { name: "Physics for 10-A" })).toBeVisible();

  await page.goto("/teacher");
  await page.getByRole("region", { name: "My Classes" }).getByRole("link", { name: "10-A" }).click();
  await expect(page.getByRole("heading", { name: "10-A" })).toBeVisible();
  await expect(page.getByText("Physics: Rania Physics")).toBeVisible();
});

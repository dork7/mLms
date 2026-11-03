import { expect, test, type Page } from "@playwright/test";

// Names here are unique to this spec: e2e specs share one database and run in parallel.
// Leave dates aren't checked against the Clock or an Academic Year, so any dates will do.
const TEACHER = "hessa.leave@school.test";
const PDF = Buffer.from("%PDF-1.4\n% a sick note\n%%EOF\n");

async function logIn(page: Page, identifier: string, password: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email, phone or Student Number").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

/** Waits for the page to hydrate, so a form isn't filled before React takes it over. */
async function open(page: Page, link: string) {
  await page.getByRole("link", { name: link }).click();
  await page.waitForLoadState("networkidle");
}

test("a Teacher requests leave with an attachment, the Admin approves it, and the Teacher sees it approved", async ({
  page,
}) => {
  await logIn(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!);
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/teachers");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Name").fill("Hessa Leave");
  await page.getByLabel("Email").fill(TEACHER);
  await page.getByRole("button", { name: "Add Teacher" }).click();
  const initialPassword = (await page.getByRole("status").locator("code").textContent())!;

  // Hessa logs in for the first time and requests leave from her phone.
  await logIn(page, TEACHER, initialPassword);
  await page.getByLabel("Current password").fill(initialPassword);
  await page.getByLabel("New password", { exact: true }).fill("hessa's own password");
  await page.getByLabel("Confirm new password").fill("hessa's own password");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page).toHaveURL(/\/teacher$/);
  await open(page, "My Leave");
  await expect(page.getByRole("heading", { name: "My Leave Requests" })).toBeVisible();

  const form = page.getByRole("region", { name: "Request leave" });
  await form.getByLabel("First day").fill("2031-03-02");
  await form.getByLabel("Last day").fill("2031-03-04");
  await form.getByLabel("Reason").fill("My sister's wedding in Al Ain");

  // A file that isn't a PDF, JPEG or PNG is refused, and the dates and reason are kept.
  await form.getByLabel(/^Attachment/).setInputFiles({ name: "note.txt", mimeType: "text/plain", buffer: Buffer.from("hi") });
  await form.getByRole("button", { name: "Submit request" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "The attachment must be a PDF, JPEG or PNG file." })).toBeVisible();
  await expect(form.getByLabel("Reason")).toHaveValue("My sister's wedding in Al Ain");

  await form.getByLabel(/^Attachment/).setInputFiles({ name: "wedding invitation.pdf", mimeType: "application/pdf", buffer: PDF });
  await form.getByRole("button", { name: "Submit request" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Your Leave Request was sent to the Admin." })).toBeVisible();
  const mine = page.getByRole("region", { name: "Your requests" }).getByRole("listitem", { name: "2031-03-02 to 2031-03-04" });
  await expect(mine).toContainText("My sister's wedding in Al Ain");
  await expect(mine).toContainText("Pending");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  // The Admin downloads the attachment and approves the request.
  await logIn(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!);
  await expect(page).toHaveURL(/\/admin$/);
  await open(page, "Leave Requests");
  const waiting = page
    .getByRole("region", { name: "Waiting for a decision" })
    .getByRole("listitem", { name: "Hessa Leave: 2031-03-02 to 2031-03-04" });
  await expect(waiting).toContainText("My sister's wedding in Al Ain");
  const downloading = page.waitForEvent("download");
  await waiting.getByRole("link", { name: "Download wedding invitation.pdf" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("wedding invitation.pdf");
  const { readFile } = await import("node:fs/promises");
  expect(await readFile((await download.path())!)).toEqual(PDF);

  await waiting.getByRole("button", { name: "Approve" }).click();
  const decided = page
    .getByRole("region", { name: "Decided" })
    .getByRole("listitem", { name: "Hessa Leave: 2031-03-02 to 2031-03-04" });
  await expect(decided).toContainText(/Approved by /);
  await expect(waiting).toHaveCount(0);

  // Hessa sees her request approved.
  await logIn(page, TEACHER, "hessa's own password");
  await expect(page).toHaveURL(/\/teacher$/);
  await open(page, "My Leave");
  await expect(mine).toContainText(/Approved by /);
});

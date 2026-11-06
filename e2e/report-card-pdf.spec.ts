import { readFile } from "node:fs/promises";
import { expect, test, type Download, type Page } from "@playwright/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

// The one smoke test that renders real PDFs with Playwright. Names and dates are unique to this
// spec: e2e specs share one database and run in parallel. It owns year 2111-2112, Grade 31 and
// Cartography, and says nothing about rank, since report-cards.spec owns that switch.
async function logIn(page: Page, identifier: string, password: string) {
  await page.context().clearCookies();
  await open(page, "/login");
  await page.getByLabel("Email, phone or Student Number").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

async function logInAsAdmin(page: Page) {
  await logIn(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!);
  await expect(page).toHaveURL(/\/admin$/);
}

async function firstLogIn(page: Page, identifier: string, initial: string, own: string) {
  await logIn(page, identifier, initial);
  await expect(page.getByLabel("Current password")).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Current password").fill(initial);
  await page.getByLabel("New password", { exact: true }).fill(own);
  await page.getByLabel("Confirm new password").fill(own);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page).toHaveURL(/\/student$/);
}

async function registerAndEnroll(page: Page, name: string, number: string): Promise<{ initial: string; profile: string }> {
  await open(page, "/admin/students");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Student Number").fill(number);
  await page.getByLabel("Date of birth").fill("2099-03-03");
  await page.getByLabel("National ID").fill(`784-${number}`);
  await page.getByLabel("Guardian contact").fill("Guardian");
  await page.getByLabel("Admission date").fill("2111-08-25");
  await page.getByRole("button", { name: "Register Student" }).click();
  const status = page.getByRole("status").filter({ hasText: number });
  await expect(status).toBeVisible();
  const initial = (await status.locator("code").textContent())!;
  await page.getByRole("listitem").filter({ hasText: name }).getByRole("link", { name: "Profile" }).click();
  await expect(page).toHaveURL(/\/admin\/students\/[^/]+$/);
  await page.waitForLoadState("networkidle");
  const profile = new URL(page.url()).pathname;
  await page.getByRole("combobox", { name: "Class" }).selectOption({ label: "31-P (Grade 31, 2111-2112)" });
  await page.getByLabel("From").fill("2111-09-01");
  await page.getByRole("button", { name: "Enroll" }).click();
  await expect(page.getByText("From 2111-09-01 · Current")).toBeVisible();
  return { initial, profile };
}

/** A PDF's pages as text, read back with a real PDF parser. */
async function pdfPages(bytes: Uint8Array): Promise<string[]> {
  expect(Buffer.from(bytes.subarray(0, 5)).toString()).toBe("%PDF-");
  const pdf = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise;
  const pages = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const { items } = await (await pdf.getPage(n)).getTextContent();
    pages.push(items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }
  return pages;
}

async function pagesOf(download: Download): Promise<string[]> {
  return pdfPages(await readFile(await download.path()));
}

const REEM = { name: "Reem Pdf", number: "E2E-PDF-1", password: "reem's own password" };
const TARIQ = { name: "Tariq Pdf", number: "E2E-PDF-2", password: "tariq's own password" };
const TEACHER = "salma.pdf@school.test";
const REMARK = "Knows the <b>stars</b> & planets";

test("Report Cards render to real PDFs for the Student and the Admin, and nobody gets another Student's", async ({ page }) => {
  await logInAsAdmin(page);

  await open(page, "/admin/academic-years");
  await page.getByLabel("Academic Year name").fill("2111-2112");
  await page.getByLabel("First day", { exact: true }).fill("2111-09-01");
  await page.getByLabel("Last day", { exact: true }).fill("2112-06-30");
  await page.getByLabel("Term 1 name").fill("Whole of 2111");
  await page.getByLabel("Term 1 first day").fill("2111-09-01");
  await page.getByLabel("Term 1 last day").fill("2112-06-30");
  await page.getByRole("button", { name: "Create Academic Year" }).click();
  await expect(page.getByRole("heading", { name: /2111-2112/ })).toBeVisible();

  await open(page, "/admin/grades");
  // The add form clears itself once saved. Until then its own input holds the name, so a locator
  // by value alone would pass before the save.
  await page.getByLabel("Grade name").first().fill("Grade 31");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByLabel("Grade name").first()).toHaveValue("");
  await expect(page.locator('input[name="name"][value="Grade 31"]')).toBeVisible();

  await open(page, "/admin/subjects");
  await page.getByLabel("Subject name").first().fill("Cartography");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByLabel("Subject name").first()).toHaveValue("");
  await expect(page.locator('input[name="name"][value="Cartography"]')).toBeVisible();

  await open(page, "/admin/teachers");
  await page.getByLabel("Name").fill("Salma Pdf");
  await page.getByLabel("Email").fill(TEACHER);
  await page.getByRole("button", { name: "Add Teacher" }).click();
  const teacherInitial = (await page.getByRole("status").locator("code").textContent())!;

  await open(page, "/admin/classes");
  await page.getByRole("combobox", { name: "Academic Year" }).selectOption({ label: "2111-2112" });
  await page.getByRole("combobox", { name: "Grade", exact: true }).selectOption({ label: "Grade 31" });
  await page.getByLabel("Class name").fill("31-P");
  await page.getByRole("combobox", { name: "Class Teacher" }).selectOption({ label: "Salma Pdf" });
  await page.getByRole("button", { name: "Add Class" }).click();
  await page.getByRole("link", { name: "31-P" }).click();
  await expect(page.getByRole("button", { name: "Add Class Subject" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.getByRole("combobox", { name: "Subject", exact: true }).selectOption({ label: "Cartography" });
  await page.getByRole("combobox", { name: "Subject Teacher", exact: true }).selectOption({ label: "Salma Pdf" });
  await page.getByRole("button", { name: "Add Class Subject" }).click();
  await expect(page.getByRole("combobox", { name: "Subject Teacher of Cartography" })).toHaveValue(/.+/);

  const reem = await registerAndEnroll(page, REEM.name, REEM.number);
  const tariq = await registerAndEnroll(page, TARIQ.name, TARIQ.number);

  // Salma enters Marks.
  await logIn(page, TEACHER, teacherInitial);
  await expect(page.getByLabel("Current password")).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Current password").fill(teacherInitial);
  await page.getByLabel("New password", { exact: true }).fill("salma's own password");
  await page.getByLabel("Confirm new password").fill("salma's own password");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page).toHaveURL(/\/teacher$/);
  await open(page, "/teacher");
  await page.getByRole("region", { name: "My Class Subjects" }).getByRole("link", { name: "Cartography for 31-P" }).click();
  const create = page.getByRole("region", { name: "New Assessment" });
  await expect(create).toBeVisible();
  await page.waitForLoadState("networkidle");
  await create.getByRole("combobox", { name: "Type" }).selectOption({ label: "Quiz" });
  await create.getByLabel("Date").fill("2111-10-10");
  await create.getByLabel("Maximum marks").fill("10");
  await create.getByLabel("Weight").fill("1");
  await create.getByRole("button", { name: "Create Assessment" }).click();
  await expect(page.getByRole("heading", { name: "Quiz on 2111-10-10" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  const grid = page.getByRole("region", { name: "Marks", exact: true });
  await grid.getByLabel(`Mark for ${REEM.name}`).fill("7");
  await grid.getByLabel(`Mark for ${TARIQ.name}`).fill("9");
  await grid.getByRole("button", { name: "Save Marks" }).click();
  await expect(grid.getByRole("status").filter({ hasText: "Marks saved." })).toBeVisible();

  // A remark that looks like markup must print as the words she typed.
  await open(page, "/teacher");
  await page.getByRole("region", { name: "My Classes" }).getByRole("link", { name: "31-P" }).click();
  await page.getByRole("link", { name: "Write overall remarks" }).click();
  await expect(page.getByRole("button", { name: "Save remark" }).first()).toBeVisible();
  await page.waitForLoadState("networkidle");
  const remarkRow = page.getByRole("region", { name: new RegExp(REEM.name) });
  await remarkRow.getByRole("textbox").fill(REMARK);
  await remarkRow.getByRole("button", { name: "Save remark" }).click();
  await expect(remarkRow.getByRole("status")).toBeVisible();

  // Before Publish, the Admin's export of the whole Class says it's a draft on every page.
  await logInAsAdmin(page);
  await open(page, "/admin/report-cards");
  await page.getByRole("link", { name: "31-P" }).click();
  await expect(page.getByRole("heading", { name: "Report Cards: 31-P" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  const previewUrl = page.url();
  const [draftDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Export the whole Class as a draft PDF" }).click(),
  ]);
  const draft = await pagesOf(draftDownload);
  expect(draft).toHaveLength(2);
  expect(draft[0]).toContain(REEM.name);
  expect(draft[1]).toContain(TARIQ.name);
  for (const pageText of draft) expect(pageText).toContain("Draft: not Published");

  await page.getByRole("region", { name: "Publish", exact: true }).getByRole("button", { name: "Publish Report Cards" }).click();
  await expect(page.getByRole("button", { name: "Unpublish Report Cards" })).toBeVisible();

  // Published, the whole Class is one printable PDF with one Student on each page.
  const [classDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Export the whole Class as PDF" }).click(),
  ]);
  expect(classDownload.suggestedFilename()).toBe("report-cards-31-P-2112-06-30.pdf");
  const whole = await pagesOf(classDownload);
  expect(whole).toHaveLength(2);
  expect(whole[0]).toContain(REEM.name);
  expect(whole[0]).toContain("70%");
  expect(whole[0]).not.toContain(TARIQ.name);
  expect(whole[1]).toContain(TARIQ.name);
  expect(whole[1]).toContain("90%");
  for (const pageText of whole) expect(pageText).not.toContain("Draft");

  // One Student's, from the preview and from their profile.
  const [oneDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("region", { name: new RegExp(TARIQ.name) }).getByRole("link", { name: "Export as PDF" }).click(),
  ]);
  expect(oneDownload.suggestedFilename()).toBe(`report-card-${TARIQ.number}-2112-06-30.pdf`);
  const one = await pagesOf(oneDownload);
  expect(one).toHaveLength(1);
  expect(one[0]).toContain(TARIQ.name);
  expect(one[0]).toContain("Cartography");

  await open(page, tariq.profile);
  const [profileDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Download PDF" }).click(),
  ]);
  expect((await pagesOf(profileDownload))[0]).toContain(TARIQ.name);

  // Reem downloads her own.
  await firstLogIn(page, REEM.number, reem.initial, REEM.password);
  await open(page, "/student/report-cards");
  const card = page.getByRole("region", { name: "Whole of 2111 (2111-2112)" });
  const link = card.getByRole("link", { name: "Download PDF" });
  const [ownDownload] = await Promise.all([page.waitForEvent("download"), link.click()]);
  expect(ownDownload.suggestedFilename()).toBe(`report-card-${REEM.number}-2112-06-30.pdf`);
  const own = await pagesOf(ownDownload);
  expect(own).toHaveLength(1);
  expect(own[0]).toContain(REEM.name);
  expect(own[0]).toContain("Whole of 2111");
  expect(own[0]).toContain("70%");
  expect(own[0]).toContain(REMARK);

  // Asking for Tariq's, or for the Class's, gets her nothing.
  const ownPath = new URL((await link.getAttribute("href"))!, page.url()).pathname;
  const tariqId = tariq.profile.split("/").at(-1)!;
  const reemId = reem.profile.split("/").at(-1)!;
  expect((await page.request.get(ownPath.replace(reemId, tariqId))).status()).toBe(403);
  const classPdf = `${new URL(previewUrl).pathname}/pdf`;
  expect((await page.request.get(classPdf)).status()).toBe(403);

  // Unpublishing takes her download away.
  await logInAsAdmin(page);
  await open(page, previewUrl);
  await page.getByRole("button", { name: "Unpublish Report Cards" }).click();
  await expect(page.getByRole("button", { name: "Publish Report Cards" })).toBeVisible();
  await logIn(page, REEM.number, REEM.password);
  await expect(page).toHaveURL(/\/student$/);
  expect((await page.request.get(ownPath)).status()).toBe(404);
});

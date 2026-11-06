import { readFile } from "node:fs/promises";
import { expect, test, type Download, type Page } from "@playwright/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

// Payment Record PDFs, rendered for real. Names here are unique to this spec: e2e specs share
// one database and run in parallel. It owns the Students PRP-1901 and PRP-1902, the Teacher
// walid.paypdf@school.test and the Fee "Payment PDF Spec Tuition". No Academic Year is
// needed: the Fee is applied to the Students directly. The dev server uses the real clock,
// so Payment Records are dated in the past.
const HIND = { name: "Hind Paypdf", number: "PRP-1901" };
const ILYAS = { name: "Ilyas Paypdf", number: "PRP-1902" };
const TEACHER = "walid.paypdf@school.test";
const FEE = "Payment PDF Spec Tuition";
const REFERENCE = "TRX <1901> & co";
const PASSWORD = "a password of my own";

async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

async function logIn(page: Page, identifier: string, password: string) {
  await page.context().clearCookies();
  await open(page, "/login");
  await page.getByLabel("Email, phone or Student Number").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

async function logInAsAdmin(page: Page) {
  await logIn(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!);
  await expect(page).toHaveURL(/\/admin$/);
}

async function logInFirstTime(page: Page, identifier: string, initial: string, home: RegExp) {
  await logIn(page, identifier, initial);
  await expect(page.getByLabel("Current password")).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Current password").fill(initial);
  await page.getByLabel("New password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm new password").fill(PASSWORD);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page).toHaveURL(home);
  await page.waitForLoadState("networkidle");
}

async function register(page: Page, { name, number }: { name: string; number: string }): Promise<string> {
  await open(page, "/admin/students");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Student Number").fill(number);
  await page.getByLabel("Date of birth").fill("2110-04-04");
  await page.getByLabel("National ID").fill(`784-${number}`);
  await page.getByLabel("Guardian contact").fill("Guardian");
  await page.getByLabel("Admission date").fill("2025-01-01");
  await page.getByRole("button", { name: "Register Student" }).click();
  const status = page.getByRole("status").filter({ hasText: number });
  await expect(status).toBeVisible();
  return (await status.locator("code").textContent())!;
}

/** Opens a Student's Fee Assignment of the spec's Fee and logs one Payment Record against it. */
async function logPayment(page: Page, student: string, amount: string, method: string, reference: string) {
  await open(page, "/admin/fees");
  await page.getByRole("link", { name: FEE }).click();
  await expect(page.getByRole("heading", { name: FEE })).toBeVisible();
  await page.getByRole("region", { name: "Fee Assignments" }).getByRole("link", { name: student }).click();
  await expect(page.getByRole("heading", { name: `${FEE}: ${student}` })).toBeVisible();
  await page.waitForLoadState("networkidle");
  const form = page.getByRole("region", { name: "Log a Payment Record" });
  await form.getByLabel("Amount (AED)").fill(amount);
  await form.getByLabel("Date").fill("2025-02-03");
  await form.getByRole("combobox", { name: "Method" }).selectOption({ label: method });
  await form.getByLabel("Reference").fill(reference);
  await form.getByRole("button", { name: "Log Payment Record" }).click();
  await expect(page.getByRole("region", { name: "Payment Records" }).getByText(reference)).toBeVisible();
}

/** A PDF's text, read back with a real PDF parser, with every kind of space as one space. */
async function pdfText(download: Download): Promise<string> {
  const bytes = await readFile(await download.path());
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  const pdf = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise;
  expect(pdf.numPages).toBe(1);
  const { items } = await (await pdf.getPage(1)).getTextContent();
  return items
    .map((item) => ("str" in item ? item.str : ""))
    .join(" ")
    .replace(/\s+/g, " ");
}

function expectHindsPaymentRecord(text: string) {
  expect(text).toContain("Payment Record");
  expect(text).not.toMatch(/receipt/i);
  expect(text).toContain(`${HIND.name} (${HIND.number})`);
  expect(text).toContain("AED 750.25");
  expect(text).toContain("2025-02-03");
  expect(text).toContain("Bank transfer");
  expect(text).toContain(REFERENCE);
  expect(text).toContain(FEE);
  expect(text).toContain("AED 2,000.00");
  expect(text).toContain("Partially Paid");
  expect(text).toContain("AED 750.25 paid of AED 2,000.00");
}

test("a Student downloads their own Payment Record as a PDF, the Admin any, and no one else", async ({ page }) => {
  await logInAsAdmin(page);
  const hindInitial = await register(page, HIND);
  await register(page, ILYAS);

  await open(page, "/admin/teachers");
  await page.getByLabel("Name").fill("Walid Paypdf");
  await page.getByLabel("Email").fill(TEACHER);
  await page.getByRole("button", { name: "Add Teacher" }).click();
  const teacherInitial = (await page.getByRole("status").filter({ hasText: "Walid Paypdf" }).locator("code").textContent())!;

  await open(page, "/admin/fees");
  await page.getByLabel("Name").fill(FEE);
  await page.getByLabel("Amount (AED)").fill("2,000");
  await page.getByLabel("Due date").fill("2125-01-01");
  await page.getByRole("button", { name: "Define Fee" }).click();
  await page.getByRole("link", { name: FEE }).click();
  await expect(page.getByRole("heading", { name: FEE })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.getByLabel(`${HIND.name} (${HIND.number})`).check();
  await page.getByLabel(`${ILYAS.name} (${ILYAS.number})`).check();
  await page.getByRole("button", { name: "Apply" }).last().click();
  await expect(page.getByRole("status").filter({ hasText: "New Fee Assignments: 2." })).toBeVisible();

  await logPayment(page, ILYAS.name, "2,000", "Cash", "R-1902");
  const ilyasPdf = (await page.getByRole("link", { name: "Download PDF" }).getAttribute("href"))!;
  await logPayment(page, HIND.name, "750.25", "Bank transfer", REFERENCE);

  // The Admin downloads Hind's from her Fee Assignment.
  const record = page.getByRole("region", { name: "Payment Records" }).getByRole("listitem").filter({ hasText: REFERENCE });
  const hindPdf = (await record.getByRole("link", { name: "Download PDF" }).getAttribute("href"))!;
  const [adminDownload] = await Promise.all([
    page.waitForEvent("download"),
    record.getByRole("link", { name: "Download PDF" }).click(),
  ]);
  expect(adminDownload.suggestedFilename()).toMatch(new RegExp(`^payment-record-${HIND.number}-\\d+\\.pdf$`));
  expectHindsPaymentRecord(await pdfText(adminDownload));

  // Hind downloads her own from My Fees.
  await logInFirstTime(page, HIND.number, hindInitial, /\/student$/);
  await page.getByRole("link", { name: "My Fees" }).click();
  await expect(page.getByRole("heading", { name: "My Fees" })).toBeVisible();
  const own = page.getByRole("listitem").filter({ hasText: REFERENCE }).getByRole("link", { name: "Download PDF" });
  const [ownDownload] = await Promise.all([page.waitForEvent("download"), own.click()]);
  expect(ownDownload.suggestedFilename()).toBe(adminDownload.suggestedFilename());
  expectHindsPaymentRecord(await pdfText(ownDownload));

  // Ilyas's is refused to her, and both are refused to a Teacher.
  expect((await page.request.get(ilyasPdf)).status()).toBe(403);
  await logInFirstTime(page, TEACHER, teacherInitial, /\/teacher$/);
  expect((await page.request.get(hindPdf)).status()).toBe(403);
  expect((await page.request.get(ilyasPdf)).status()).toBe(403);
});

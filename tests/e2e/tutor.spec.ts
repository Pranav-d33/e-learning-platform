import path from "node:path";
import { expect, test } from "@playwright/test";
import { collectErrors } from "./helpers";

const SAMPLES = path.join(process.cwd(), "public", "samples");

test("teacher builds, reviews, edits and runs a demo quiz; student sees scored results", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/tutor/generate?doc=demo-reader");
  await page.getByRole("radio", { name: "A chapter" }).check({ force: true });
  await page.getByLabel("Chapter", { exact: true }).selectOption({ label: "Unit 1 — Our Garden (p. 2–3)" });
  // Only MCQ + fill in the blank for a deterministic, fully objective quiz
  const types = page.getByRole("group", { name: "Question types" });
  await types.getByText("Short answer", { exact: true }).click();
  await types.getByText("Reading comprehension", { exact: true }).click();
  await page.getByRole("button", { name: "Fewer questions" }).click();
  await page.getByRole("button", { name: /Generate 4 questions/ }).click();

  await expect(page).toHaveURL(/\/tutor\/review\//, { timeout: 30_000 });
  const cards = page.locator("article[id^=q-]");
  await expect(cards).toHaveCount(4);
  await expect(page.getByText("Verified against source").first()).toBeVisible();

  // Citation opens the exact page with the quote highlighted
  await page.getByRole("button", { name: /Open page 2 of the source/ }).first().click();
  await expect(page.getByRole("dialog").locator("mark")).toBeVisible();
  await page.keyboard.press("Escape");

  // Edit the first question → teacher edited (not "verified")
  await cards.first().getByRole("button", { name: "Edit" }).click();
  const text = page.getByLabel("Question", { exact: true });
  await text.fill(`${await text.inputValue()} (edited)`);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(cards.first().getByText("Teacher edited")).toBeVisible();
  await expect(cards.first()).toContainText("(edited)");

  await page.getByRole("button", { name: "Start quiz" }).click();
  await expect(page).toHaveURL(/\/tutor\/quiz\//);

  // Answer: MCQs → first option; blanks → a wrong word, so we can check exact scoring
  for (let i = 0; i < 4; i++) {
    await expect(page.getByText(`Question ${i + 1} of 4`)).toBeVisible();
    const radios = page.getByRole("radio");
    if (await radios.count()) await radios.first().click();
    else await page.getByLabel("Missing word", { exact: true }).fill("zzz");
    await page.getByRole("button", { name: i < 3 ? "Next" : "Review answers", exact: true }).click();
  }
  await expect(page.getByText("Ready to hand in?")).toBeVisible();
  await page.getByRole("button", { name: "Submit answers" }).click();

  await expect(page).toHaveURL(/\/tutor\/results\//, { timeout: 30_000 });
  await expect(page.getByRole("img", { name: /Score \d+ out of \d+/ })).toBeVisible();
  await expect(page.getByText("Scored exactly (accepted answers)").first()).toBeVisible();
  await expect(page.getByText("Not yet").first()).toBeVisible(); // "zzz" is never accepted
  errors.expectNone();
});

test("quiz setup validates before generating", async ({ page }) => {
  await page.goto("/tutor/generate?doc=demo-reader");
  const types = page.getByRole("group", { name: "Question types" });
  for (const t of ["Multiple choice", "Fill in the blank", "Short answer", "Reading comprehension"])
    await types.getByText(t, { exact: true }).click();
  await page.getByRole("button", { name: /Generate/ }).click();
  await expect(page.getByText("Choose at least one question type.")).toBeVisible();
  await expect(page).toHaveURL(/\/tutor\/generate/);
});

test("uploading a searchable PDF indexes its pages; a scanned PDF explains why it failed", async ({ page }) => {
  await page.goto("/tutor");
  await page.getByLabel("Choose a PDF to upload").setInputFiles(path.join(SAMPLES, "sunny-steps-demo-reader.pdf"));
  const title = `E2E reader ${Date.now()}`;
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: "Upload and index" }).click();
  await expect(page.getByText("Ready to use")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/7 pages, 7 chunks/)).toBeVisible();

  const row = page.locator("li", { hasText: title });
  await row.getByRole("link", { name: "Preview" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await page.getByRole("button", { name: /p\. 4/ }).click();
  await expect(page.getByText("Arun had a bright red kite.").first()).toBeVisible();

  await page.goto("/tutor");
  await page.getByLabel("Choose a PDF to upload").setInputFiles(path.join(SAMPLES, "scanned-sample.pdf"));
  await page.getByRole("button", { name: "Upload and index" }).click();
  await expect(page.getByText(/looks scanned/).first()).toBeVisible({ timeout: 30_000 });

  await page.getByLabel("Choose a PDF to upload").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
  await expect(page.getByText(/isn't a PDF/)).toBeVisible();
});

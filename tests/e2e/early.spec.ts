import { expect, test } from "@playwright/test";
import { collectErrors, drawOnBoard } from "./helpers";

test.use({ launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"] } });

test("lesson plays the letter, then the words, and navigates between letters", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/early/en");
  await expect(page.getByText("0 of 26 explored")).toBeVisible();
  await page.getByRole("link", { name: "Letter A" }).click();

  await page.getByRole("button", { name: "Hear the letter A" }).click();
  await expect(page.locator("p[aria-live=polite]")).toHaveText(/^(A|A for apple)$/);
  await page.getByRole("button", { name: "Hear words" }).click();
  await expect(page.locator("p[aria-live=polite]")).toHaveText(/apple|ant/);
  await expect(page.getByRole("button", { name: "Stop" }).first()).toBeVisible();

  await page.getByRole("link", { name: "Next letter B" }).click();
  await expect(page.getByRole("button", { name: "Hear the letter B" })).toBeVisible();
  // Changing letters stops the previous audio
  await expect(page.getByRole("button", { name: "Hear words" })).toBeVisible();
  await page.getByRole("link", { name: "All letters" }).click();
  await expect(page.getByText(/2 of 26 explored/)).toBeVisible();
  errors.expectNone();
});

test("tracing: empty check never succeeds, partial names the missing stroke, a full trace earns a star", async ({ page }) => {
  await page.goto("/early/en/l/trace");
  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.getByText("Draw on the light letter with your finger.")).toBeVisible();

  await drawOnBoard(page, [[[64, 30], [64, 170]]]);
  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.getByText("Good try! Trace line two again.")).toBeVisible();

  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("button", { name: "Clear" })).toBeDisabled();
  await drawOnBoard(page, [[[64, 30], [64, 170]], [[64, 170], [140, 170]]]);
  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.getByText("Wonderful! You traced it.")).toBeVisible();
  await expect(page.getByLabel("1 letter traced")).toBeVisible();
  await expect(page.getByRole("img", { name: "3 of 3 stars" })).toBeVisible();
});

test("tracing controls: undo, guide toggle, show me", async ({ page }) => {
  await page.goto("/early/en/a/trace");
  await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
  await drawOnBoard(page, [[[100, 30], [52, 170]]]);
  await expect(page.getByRole("button", { name: "Undo" })).toBeEnabled();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
  await page.getByRole("button", { name: "Hide guide" }).click();
  await expect(page.getByRole("button", { name: "Show guide" })).toBeVisible();
  await page.getByRole("button", { name: "Show me" }).click();
  await expect(page.locator("path.draw-stroke")).toHaveCount(3);
});

test("Hindi lessons render Devanagari and offer outline tracing", async ({ page }) => {
  await page.goto("/early/hi");
  await expect(page.getByRole("heading", { name: "अक्षर चुनो" })).toBeVisible();
  await page.getByRole("link", { name: "अक्षर क" }).click();
  await expect(page.getByRole("button", { name: "Hear the letter क" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Hear कबूतर" })).toBeVisible();
  await page.getByRole("link", { name: "Trace" }).click();
  await expect(page.getByRole("button", { name: "Show me" })).toBeDisabled();
  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.getByText("हल्के अक्षर पर उँगली से लिखो।")).toBeVisible();
});

test("progress can be reset from the grown-ups panel", async ({ page }) => {
  await page.goto("/early/en/c");
  await page.waitForFunction(() => localStorage.getItem("alp:early:v1")?.includes("en:c"));
  await page.goto("/early");
  await expect(page.getByRole("link", { name: /Continue with/ })).toBeVisible();
  await page.getByText("For grown-ups").click();
  await page.getByRole("button", { name: "Reset progress" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Reset" }).click();
  await expect(page.getByRole("link", { name: /Continue with/ })).toHaveCount(0);
});

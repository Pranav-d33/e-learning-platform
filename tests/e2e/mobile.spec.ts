import { expect, test } from "@playwright/test";
import { drawOnBoard } from "./helpers";

for (const path of ["/", "/tutor", "/tutor/generate", "/early", "/early/hi", "/early/en/b", "/early/en/b/trace"]) {
  test(`no horizontal scroll on phones: ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test("tracing canvas blocks page scroll only on the canvas and still scores", async ({ page }) => {
  await page.goto("/early/en/t/trace");
  const touchAction = await page.locator("canvas").evaluate((el) => getComputedStyle(el).touchAction);
  expect(touchAction).toBe("none");
  const bodyTouch = await page.evaluate(() => getComputedStyle(document.body).touchAction);
  expect(bodyTouch).not.toBe("none");
  await drawOnBoard(page, [[[48, 30], [152, 30]], [[100, 30], [100, 170]]]);
  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.getByText("Wonderful! You traced it.")).toBeVisible();
});

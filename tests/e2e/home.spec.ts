import { expect, test } from "@playwright/test";
import { collectErrors } from "./helpers";

test("home shows both modules and the demo-mode label", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Quizzes that cite the page");
  await expect(page.getByText("Demo mode").first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Textbook AI Tutor/ })).toBeVisible();
  await page.getByRole("link", { name: /Early Learning Studio/ }).click();
  await expect(page).toHaveURL(/\/early$/);
  await expect(page.getByRole("heading", { name: "Who is learning today?" })).toBeVisible();
  errors.expectNone();
});

test("unknown routes get a helpful 404", async ({ page }) => {
  const res = await page.goto("/nope/not-here");
  expect(res?.status()).toBe(404);
  await expect(page.getByText("This page isn't in the book")).toBeVisible();
});

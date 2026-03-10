import { test, expect } from "@playwright/test";

test("dashboard smoke", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Live NSE F&O Intelligence Dashboard/i })).toBeVisible();
  await expect(page.getByText(/OI VIBE/i)).toBeVisible();
  await expect(page.getByText(/OI Wall Heatmap/i)).toBeVisible();
});
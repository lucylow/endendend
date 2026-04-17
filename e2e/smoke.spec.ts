import { test, expect } from "@playwright/test";

test("document loads with app title", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Tashi Swarm Control Center/);
});

import { expect, test } from "./fixtures";

test.describe("Track page", () => {
  test("Track page loads and shows the nutrition card search input", async ({ page }) => {
    // Track is the default page at /
    await page.goto("/");

    const nutritionCard = page.locator('[data-slot="nutrition-card"]');
    await expect(nutritionCard).toBeVisible();
    await expect(nutritionCard.getByLabel("Search foods").first()).toBeVisible();
  });

  test("track page exposes water logging affordances", async ({ page }) => {
    await page.goto("/");

    const nutritionCard = page.locator('[data-slot="nutrition-card"]');
    await expect(nutritionCard.locator('button[aria-label="Log water"]')).toBeVisible();
    await expect(nutritionCard.locator('[data-slot="water-progress"]')).toBeVisible();
  });
});

import { expect, test } from "./fixtures";

/**
 * E2E tests for food tracking via the NutritionCard.
 *
 * Tests:
 * 1. NutritionCard search input is visible with log button
 * 2. Can log a raw food entry through the NutritionCard
 * 3. Food appears in Today's Log
 */
test.describe("Food tracking", () => {
  const getNutritionCard = (page: import("@playwright/test").Page) =>
    page.locator('[data-slot="nutrition-card"]');

  test("nutrition card is visible with input and log button", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible();

    const nutritionCard = getNutritionCard(page);
    await expect(nutritionCard).toBeVisible();

    const searchInput = nutritionCard.getByLabel("Search foods").first();
    await expect(searchInput).toBeVisible();

    // Should have Log Food button
    const logButton = nutritionCard.locator('[data-slot="log-food-button"]');
    await expect(logButton).toBeVisible();
  });

  test("can log a food item", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible();

    const nutritionCard = getNutritionCard(page);
    const foodInput = nutritionCard.getByLabel("Search foods").first();

    // Enter a food item
    await foodInput.fill("Grilled chicken salad");

    // Click Log Food
    const logButton = nutritionCard.locator('[data-slot="log-food-button"]');
    await logButton.click();
    await page.waitForTimeout(500);

    // Input should be cleared after successful log
    await expect(foodInput).toHaveValue("");
  });

  test("food appears in Today's Log after logging", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible();

    const nutritionCard = getNutritionCard(page);
    const foodInput = nutritionCard.getByLabel("Search foods").first();

    // Log a unique food item
    const uniqueFood = `Test Food ${Date.now()}`;
    await foodInput.fill(uniqueFood);

    const logButton = nutritionCard.locator('[data-slot="log-food-button"]');
    await logButton.click();
    await page.waitForTimeout(1500);

    // Check Today's Log for the Food group
    const foodGroupButton = page.locator("button", { hasText: /Food intake/i }).first();
    await expect(foodGroupButton).toBeVisible();

    // Expand the Food group
    await foodGroupButton.click();
    await page.waitForTimeout(500);

    // Should see our logged food
    const foodEntry = page.locator(`text=${uniqueFood}`).first();
    await expect(foodEntry).toBeVisible();
  });
});

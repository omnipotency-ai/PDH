import { expect, test } from "./fixtures";

/**
 * E2E tests for food tracking.
 *
 * Tests:
 * 1. Food section is visible with input
 * 2. Log a food item
 * 3. Food appears in Today's Log
 */
test.describe("Food tracking", () => {
  // Helper to get the FoodSection
  const getFoodSection = (page: import("@playwright/test").Page) =>
    page.locator("section.glass-card-food");

  test("food section is visible with input and log button", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible();

    const foodSection = getFoodSection(page);
    await expect(foodSection).toBeVisible();

    // Should have input with placeholder
    const foodInput = foodSection.locator('input[placeholder="eg. Ham sandwich"]');
    await expect(foodInput).toBeVisible();

    // Should have Log Food button
    const logButton = foodSection.locator("button", { hasText: "Log Food" });
    await expect(logButton).toBeVisible();
  });

  test("can log a food item", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible();

    const foodSection = getFoodSection(page);
    const foodInput = foodSection.locator('input[placeholder="eg. Ham sandwich"]');

    // Enter a food item
    await foodInput.fill("Grilled chicken salad");

    // Click Log Food
    const logButton = foodSection.locator("button", { hasText: "Log Food" });
    await logButton.click();
    await page.waitForTimeout(500);

    // Input should be cleared after successful log
    await expect(foodInput).toHaveValue("");
  });

  test("food appears in Today's Log after logging", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible();

    const foodSection = getFoodSection(page);
    const foodInput = foodSection.locator('input[placeholder="eg. Ham sandwich"]');

    // Log a unique food item
    const uniqueFood = `Test Food ${Date.now()}`;
    await foodInput.fill(uniqueFood);

    const logButton = foodSection.locator("button", { hasText: "Log Food" });
    await logButton.click();
    await page.waitForTimeout(500);

    // Check Today's Log for the Food group
    const foodGroupButton = page.locator("button", { hasText: /^Food/ }).first();
    await expect(foodGroupButton).toBeVisible();

    // Expand the Food group
    await foodGroupButton.click();
    await page.waitForTimeout(300);

    // Should see our logged food
    const foodEntry = page.locator(`text=${uniqueFood}`).first();
    await expect(foodEntry).toBeVisible();
  });
});

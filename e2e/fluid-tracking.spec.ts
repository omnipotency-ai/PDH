import { expect, test } from "./fixtures";

/**
 * E2E tests for fluid tracking in the post-NutritionCard flow.
 *
 * Tests:
 * 1. NutritionCard exposes water logging affordances
 * 2. Can log water
 * 3. Can log a non-water drink through NutritionCard search
 * 4. Fluid total updates after multiple water entries
 */
test.describe("Fluid tracking", () => {
  const getNutritionCard = (page: import("@playwright/test").Page) =>
    page.locator('[data-slot="nutrition-card"]');

  // Helper to get the Fluids group button in Today's Log
  const getFluidsGroupButton = (page: import("@playwright/test").Page) =>
    page.locator("button", { hasText: /^Fluids/ }).first();

  test("nutrition card exposes water logging affordances", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible();

    const nutritionCard = getNutritionCard(page);
    await expect(nutritionCard).toBeVisible();

    // Should have Water button
    const waterButton = nutritionCard.locator('button[aria-label="Log water"]');
    await expect(waterButton).toBeVisible();

    // Should have water progress row
    const waterProgress = nutritionCard.locator('[data-slot="water-progress"]');
    await expect(waterProgress).toBeVisible();
  });

  test("can log water", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible();

    const nutritionCard = getNutritionCard(page);
    const waterButton = nutritionCard.locator('button[aria-label="Log water"]');
    await waterButton.click();
    await page.waitForTimeout(200);

    const modal = page.locator('[data-slot="water-modal"]');
    await expect(modal).toBeVisible();

    const increaseButton = modal.locator('button[aria-label="Increase amount"]');
    await increaseButton.click();
    await page.waitForTimeout(100);

    const logButton = modal.getByRole("button", { name: /Log Water/i });
    await logButton.click();
    await page.waitForTimeout(1000);

    // Fluids group should show in Today's Log
    const fluidsGroupButton = getFluidsGroupButton(page);
    await expect(fluidsGroupButton).toBeVisible();
  });

  test("can log a non-water drink through NutritionCard search", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible();

    const nutritionCard = getNutritionCard(page);
    const searchInput = nutritionCard.getByLabel("Search foods").first();
    await searchInput.fill("clear broth");

    const searchResults = nutritionCard.locator('[data-slot="search-results"]');
    await expect(searchResults).toBeVisible();
    const brothResult = searchResults.locator('[data-slot="search-result"]', {
      hasText: /clear broth/i,
    });
    await brothResult.locator('button[aria-label$="to staging"]').click();

    const logFoodButton = nutritionCard.locator('[data-slot="log-food-button"]');
    await expect(logFoodButton).toContainText("1");
    await logFoodButton.click();

    const modal = page.locator('[data-slot="log-food-modal"]');
    await expect(modal).toBeVisible();
    await modal.locator('[data-slot="log-food-actions"]').getByText("Log Food", { exact: true }).click();
    await page.waitForTimeout(1500);

    const foodGroupButton = page.locator("button", { hasText: /Food intake/i }).first();
    await expect(foodGroupButton).toBeVisible();
    await foodGroupButton.click();
    await page.waitForTimeout(500);

    await expect(page.locator("text=Clear broth").first()).toBeVisible();
  });

  test("fluid total updates after multiple entries", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible();

    const nutritionCard = getNutritionCard(page);
    const waterButton = nutritionCard.locator('button[aria-label="Log water"]');

    // Log first water entry (200ml)
    await waterButton.click();
    await page.waitForTimeout(200);
    let modal = page.locator('[data-slot="water-modal"]');
    await expect(modal).toBeVisible();
    await modal.getByRole("button", { name: /Log Water/i }).click();
    await page.waitForTimeout(1000);

    // Capture the total after the first entry
    const fluidsGroupButton = getFluidsGroupButton(page);
    await expect(fluidsGroupButton).toBeVisible();
    const badgeAfterFirst = fluidsGroupButton.locator("span.font-mono").first();
    const textAfterFirst = await badgeAfterFirst.textContent();
    const totalAfterFirst = Number.parseFloat(textAfterFirst ?? "0");

    // Log second water entry (400ml)
    await waterButton.click();
    await page.waitForTimeout(200);
    modal = page.locator('[data-slot="water-modal"]');
    await expect(modal).toBeVisible();
    await modal.locator('button[aria-label="Increase amount"]').click();
    await page.waitForTimeout(100);
    await modal.getByRole("button", { name: /Log Water/i }).click();
    await page.waitForTimeout(1000);

    // The total should have increased by 0.4L (400ml)
    const badgeAfterSecond = getFluidsGroupButton(page).locator("span.font-mono").first();
    const textAfterSecond = await badgeAfterSecond.textContent();
    const totalAfterSecond = Number.parseFloat(textAfterSecond ?? "0");
    const addedL = totalAfterSecond - totalAfterFirst;
    // We added 400ml = 0.4L between the two captures
    expect(addedL).toBeCloseTo(0.4, 1);
  });
});

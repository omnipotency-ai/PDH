import { expect, test } from "./fixtures";
import { TrackPage } from "./page-objects";

/**
 * E2E tests for food tracking via the NutritionCard.
 *
 * Tests:
 * 1. NutritionCard search input is visible with log button
 * 2. Can log a raw food entry through the NutritionCard
 * 3. Food appears in Today's Log
 */
test.describe("Food tracking", () => {
  test("nutrition card is visible with input and log button", async ({ page }) => {
    const track = new TrackPage(page);
    await track.goto();

    await expect(track.searchInput).toBeVisible();
    await expect(track.logFoodButton).toBeVisible();
  });

  test("can log a food item", async ({ page }) => {
    const track = new TrackPage(page);
    await track.goto();

    await track.searchInput.fill("Grilled chicken salad");
    await track.logFoodButton.click();
    await expect(track.searchInput).toHaveValue("");
  });

  test("food appears in Today's Log after logging", async ({ page }) => {
    const track = new TrackPage(page);
    await track.goto();

    // Log a unique food item
    const uniqueFood = `Test Food ${Date.now()}`;
    await track.searchInput.fill(uniqueFood);

    await track.logFoodButton.click();
    await expect(track.searchInput).toHaveValue("");

    // Check Today's Log for the Food group
    const foodGroupButton = page.locator("button", { hasText: /Food intake/i }).first();
    await expect(foodGroupButton).toBeVisible();

    // Expand the Food group
    await foodGroupButton.click();

    // Should see our logged food
    const foodEntry = page.locator(`text=${uniqueFood}`).first();
    await expect(foodEntry).toBeVisible();
  });
});

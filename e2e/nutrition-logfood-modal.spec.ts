import { expect, test } from "./fixtures";

/**
 * E2E tests for the LogFoodModal component.
 *
 * Flow: NutritionCard (collapsed) -> search view -> add food to staging
 *       -> "Log Food (N)" button appears -> click to open LogFoodModal
 *       -> interact with modal (adjust quantities, review macros, log/add more)
 *
 * Prerequisites:
 * - Dev server on :3005 with Convex backend
 * - Clerk auth (auth.setup.ts)
 */

// ── Selectors ───────────────────────────────────────────────────────────────
//
// nutritionCard        — data-slot="nutrition-card" on the section element
// searchInput          — aria-label="Search foods" in the NutritionSearchInput
// searchResult         — data-slot="search-result" buttons in the search results list
// openStagingButton    — data-slot="open-staging-button" in the search view
// logFoodModal         — data-slot="log-food-modal" with role="dialog"
// logFoodItem          — data-slot="log-food-item" rows inside the modal
// logFoodTotals        — data-slot="log-food-totals" section with calories + macros
// macroPill            — data-slot="macro-pill" elements showing macro breakdowns
// logFoodActions       — data-slot="log-food-actions" section with action buttons

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Navigate to the Track page and wait for the NutritionCard to be visible.
 */
async function navigateToNutritionCard(page: import("@playwright/test").Page) {
  await page.goto("/");
  const nutritionCard = page.locator('[data-slot="nutrition-card"]');
  await expect(nutritionCard).toBeVisible();
  return nutritionCard;
}

/**
 * Enter search mode by clicking the search input in the NutritionCard.
 * Returns the search input locator.
 */
async function enterSearchMode(page: import("@playwright/test").Page) {
  const searchInput = page.locator('[data-slot="nutrition-card"]').getByLabel("Search foods").first();
  await searchInput.click();
  // Wait for search view to appear
  await expect(page.locator('[data-slot="search-view"]')).toBeVisible();
  return searchInput;
}

/**
 * Search for a food and click the first matching result.
 * The search input must already be visible (search mode entered).
 */
async function searchAndSelectFood(
  page: import("@playwright/test").Page,
  query: string,
  expectedCanonical: string,
) {
  const searchInput = page.locator('[data-slot="search-view"]').getByLabel("Search foods");
  await searchInput.fill(query);

  // Wait for search results to appear
  const resultsList = page.locator('[role="listbox"][aria-label="Search results"]');
  await expect(resultsList).toBeVisible();

  // Click the result matching the expected canonical name
  const result = resultsList.locator('[data-slot="search-result"]', { hasText: expectedCanonical });
  await expect(result).toBeVisible();
  await result.click();
}

/**
 * Open the LogFoodModal by clicking the "Log Food" staging button in search view.
 * Assumes items are already staged and the search view is visible.
 */
async function openLogFoodModal(page: import("@playwright/test").Page) {
  const stagingButton = page.locator('[data-slot="open-staging-button"]');
  await expect(stagingButton).toBeVisible();
  await stagingButton.click();

  // Wait for the modal dialog to appear
  const modal = page.locator('[data-slot="log-food-modal"]');
  await expect(modal).toBeVisible();
  return modal;
}

// ── Tests ───────────────────────────────────────────────────────────────────

test.describe("LogFoodModal", () => {
  test("searching and selecting a food shows the staging button with count", async ({ page }) => {
    await navigateToNutritionCard(page);
    await enterSearchMode(page);
    await searchAndSelectFood(page, "toast", "toast");

    // After selecting a food, the "Log Food" button with staging count should appear
    const stagingButton = page.locator('[data-slot="open-staging-button"]');
    await expect(stagingButton).toBeVisible();
    await expect(stagingButton).toContainText("Log Food");
    // Should show count badge "1"
    await expect(stagingButton).toContainText("1");
  });

  test("LogFoodModal opens and displays staged item with name and portion", async ({ page }) => {
    await navigateToNutritionCard(page);
    await enterSearchMode(page);
    await searchAndSelectFood(page, "toast", "toast");

    const modal = await openLogFoodModal(page);

    // Modal should show the staged item
    const foodItem = modal.locator('[data-slot="log-food-item"]');
    await expect(foodItem).toBeVisible();
    // "toast" should be capitalized in display as "Toast"
    await expect(foodItem).toContainText("Toast");
    // Should show portion info (toast default: 30g = 1 slice)
    await expect(foodItem).toContainText("30g");
    // Should show calories (313 * 30/100 = 94 kcal)
    await expect(foodItem).toContainText("94 kcal");
  });

  test("plus button increases portion quantity", async ({ page }) => {
    await navigateToNutritionCard(page);
    await enterSearchMode(page);
    await searchAndSelectFood(page, "toast", "toast");
    const modal = await openLogFoodModal(page);

    // Toast: unitWeightG = 30 (1 slice). Initial = 30g (1 slice).
    // After clicking +, should be 60g (2 slices).
    const increaseButton = modal.getByLabel("Increase Toast portion");
    await increaseButton.click();

    // Verify portion updated to 60g (2 slices)
    const foodItem = modal.locator('[data-slot="log-food-item"]');
    await expect(foodItem).toContainText("60g");
    // Calories should update too: 313 * 60/100 = 188 kcal
    await expect(foodItem).toContainText("188 kcal");
  });

  test("minus button decreases portion quantity", async ({ page }) => {
    await navigateToNutritionCard(page);
    await enterSearchMode(page);
    await searchAndSelectFood(page, "toast", "toast");
    const modal = await openLogFoodModal(page);

    // First increase to 60g so we can decrease
    const increaseButton = modal.getByLabel("Increase Toast portion");
    await increaseButton.click();

    // Now decrease back
    const decreaseButton = modal.getByLabel("Decrease Toast portion");
    await decreaseButton.click();

    // Should be back to 30g
    const foodItem = modal.locator('[data-slot="log-food-item"]');
    await expect(foodItem).toContainText("30g");
    await expect(foodItem).toContainText("94 kcal");
  });

  test("minus button is disabled when portion cannot be decreased further", async ({ page }) => {
    await navigateToNutritionCard(page);
    await enterSearchMode(page);
    await searchAndSelectFood(page, "toast", "toast");
    const modal = await openLogFoodModal(page);

    // At initial 30g with step 30g, canDecrement is false (30 > 30 is false)
    const decreaseButton = modal.getByLabel("Decrease Toast portion");
    await expect(decreaseButton).toBeDisabled();
  });

  test("add more button returns to search view and keeps staging", async ({ page }) => {
    await navigateToNutritionCard(page);
    await enterSearchMode(page);
    await searchAndSelectFood(page, "toast", "toast");
    await openLogFoodModal(page);

    // Click "add more..."
    const addMoreButton = page.locator('[data-slot="log-food-actions"]').getByText("add more...");
    await addMoreButton.click();

    // Modal should close
    const modal = page.locator('[data-slot="log-food-modal"]');
    await expect(modal).not.toBeVisible();

    // Search view should be visible again
    await expect(page.locator('[data-slot="search-view"]')).toBeVisible();

    // Staging button should still show count of 1 (staging preserved)
    const stagingButton = page.locator('[data-slot="open-staging-button"]');
    await expect(stagingButton).toBeVisible();
    await expect(stagingButton).toContainText("1");
  });

  test("Log Food button submits and clears staging", async ({ page }) => {
    await navigateToNutritionCard(page);
    await enterSearchMode(page);
    await searchAndSelectFood(page, "toast", "toast");
    await openLogFoodModal(page);

    // Click "Log Food" button inside the modal
    const logButton = page.locator('[data-slot="log-food-actions"]').getByText("Log Food", { exact: true });
    await logButton.click();

    // Modal should close
    const modal = page.locator('[data-slot="log-food-modal"]');
    await expect(modal).not.toBeVisible();

    // Should return to collapsed view (staging cleared, view reset)
    await expect(page.locator('[data-slot="collapsed-view"]')).toBeVisible();

    // The staging button should not be visible (no staged items)
    const stagingButton = page.locator('[data-slot="open-staging-button"]');
    await expect(stagingButton).not.toBeVisible();
  });

  test("modal shows macro totals (calories, protein, carbs, fat, sugars, fibre)", async ({
    page,
  }) => {
    await navigateToNutritionCard(page);
    await enterSearchMode(page);
    await searchAndSelectFood(page, "toast", "toast");
    const modal = await openLogFoodModal(page);

    // Totals section should be visible
    const totals = modal.locator('[data-slot="log-food-totals"]');
    await expect(totals).toBeVisible();

    // Should show total calories: 94 kcal for 30g toast
    await expect(totals).toContainText("94 kcal");

    // Macro pills should be present with labels
    const pills = totals.locator('[data-slot="macro-pill"]');
    // MACRO_PILL_CONFIG has 5 pills: Protein, Carbs, Fat, Sugars, Fibre
    await expect(pills).toHaveCount(5);
    await expect(totals).toContainText("Protein");
    await expect(totals).toContainText("Carbs");
    await expect(totals).toContainText("Fat");
    await expect(totals).toContainText("Sugars");
    await expect(totals).toContainText("Fibre");
  });

  test("modal has correct accessibility attributes and escape closes it", async ({ page }) => {
    await navigateToNutritionCard(page);
    await enterSearchMode(page);
    await searchAndSelectFood(page, "toast", "toast");
    await openLogFoodModal(page);

    // Check role="dialog" and aria-modal="true"
    const dialog = page.locator('[role="dialog"][aria-modal="true"]');
    await expect(dialog).toBeVisible();

    // Check aria-label
    await expect(dialog).toHaveAttribute("aria-label", "Log Food");

    // Pressing Escape should close the modal
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });

  test("close button (X) closes the modal", async ({ page }) => {
    await navigateToNutritionCard(page);
    await enterSearchMode(page);
    await searchAndSelectFood(page, "toast", "toast");
    await openLogFoodModal(page);

    // Click the close button via aria-label
    const closeButton = page.getByLabel("Close Log Food modal");
    await closeButton.click();

    const modal = page.locator('[data-slot="log-food-modal"]');
    await expect(modal).not.toBeVisible();
  });

  test("multiple items can be staged via search, add, search again, add another", async ({
    page,
  }) => {
    await navigateToNutritionCard(page);
    await enterSearchMode(page);

    // Stage first food: toast
    await searchAndSelectFood(page, "toast", "toast");

    // Staging button should show "1"
    const stagingButton = page.locator('[data-slot="open-staging-button"]');
    await expect(stagingButton).toContainText("1");

    // Clear search and stage second food: egg
    const searchInput = page.locator('[data-slot="search-view"]').getByLabel("Search foods");
    await searchInput.fill("");

    await searchAndSelectFood(page, "egg", "egg");

    // Staging button should now show "2"
    await expect(stagingButton).toContainText("2");

    // Open modal and verify both items
    await openLogFoodModal(page);

    const foodItems = page.locator('[data-slot="log-food-item"]');
    await expect(foodItems).toHaveCount(2);

    // Both should be visible
    const modal = page.locator('[data-slot="log-food-modal"]');
    await expect(modal).toContainText("Toast");
    await expect(modal).toContainText("Egg");

    // Header should say "2 items"
    await expect(modal).toContainText("2 items");

    // Totals should reflect combined calories:
    // Toast 30g: 94 kcal, Egg 50g: 78 kcal = 172 kcal total
    const totals = modal.locator('[data-slot="log-food-totals"]');
    await expect(totals).toContainText("172 kcal");
  });

  test("removing a staged item updates the modal", async ({ page }) => {
    await navigateToNutritionCard(page);
    await enterSearchMode(page);

    // Stage two foods
    await searchAndSelectFood(page, "toast", "toast");
    const searchInput = page.locator('[data-slot="search-view"]').getByLabel("Search foods");
    await searchInput.fill("");
    await searchAndSelectFood(page, "egg", "egg");

    await openLogFoodModal(page);

    // Remove toast using the X button
    const removeToast = page.getByLabel("Remove Toast");
    await removeToast.click();

    // Only egg should remain
    const foodItems = page.locator('[data-slot="log-food-item"]');
    await expect(foodItems).toHaveCount(1);

    const modal = page.locator('[data-slot="log-food-modal"]');
    await expect(modal).toContainText("Egg");
    await expect(modal).not.toContainText("Toast");

    // Header should say "1 item" (singular)
    await expect(modal).toContainText("1 item");
  });

  test("clear all button removes all staged items", async ({ page }) => {
    await navigateToNutritionCard(page);
    await enterSearchMode(page);

    // Stage a food
    await searchAndSelectFood(page, "toast", "toast");
    await openLogFoodModal(page);

    // Click "Clear" button
    const clearButton = page.getByLabel("Clear all staged items");
    await clearButton.click();

    // No items should remain — empty state text should appear
    const modal = page.locator('[data-slot="log-food-modal"]');
    await expect(modal).toContainText('No items staged');

    // Log Food button should be disabled when staging is empty
    const logButton = page.locator('[data-slot="log-food-actions"]').getByText("Log Food", { exact: true });
    await expect(logButton).toBeDisabled();
  });
});

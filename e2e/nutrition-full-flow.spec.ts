import { expect, test } from "./fixtures";
import { TrackPage } from "./page-objects";

/**
 * Comprehensive E2E test for the full nutrition logging flow.
 *
 * Covers the complete user journey through the NutritionCard:
 *
 *   1.  Navigate to Track page (/)
 *   2.  Verify NutritionCard renders with calorie ring, search bar, water bar
 *   3.  Verify old FoodSection and FluidSection are NOT visible
 *   4.  Type "white rice" in search — verify results appear below water bar
 *   5.  Verify "Logging to:" label is visible
 *   6.  Click a result — verify staging badge updates on Log Food button
 *   7.  Click Log Food button — verify staging modal opens
 *   8.  Verify amount shows in g, verify +/- step behavior
 *   9.  Click + — verify amount increases
 *  10.  Click Log Food in modal — verify food logged, staging clears, calorie ring updates
 *  11.  Open water modal — verify ring shows, verify increment step
 *  12.  Log water — verify water progress bar updates
 *  13.  Tap calorie ring — verify calorie detail expands BELOW the card (ring still visible)
 *  14.  Verify per-food macros show 5 values (P, C, F, S, Fi pattern)
 *  15.  Search for a liquid food ("clear broth") — verify portion display
 */

test.describe("Nutrition full flow", () => {
  test("complete 15-step nutrition logging cycle", async ({ page }) => {
    const track = new TrackPage(page);
    await track.goto();

    // ── Step 2: Verify NutritionCard renders with calorie ring, search bar, water bar ──
    await expect(track.calorieRing).toBeVisible();
    await expect(track.searchInput).toBeVisible();
    await expect(track.logFoodButton).toBeVisible();
    await expect(track.logFoodButton).toContainText("Log Food");
    await expect(track.waterProgress).toBeVisible();

    // Calorie ring should display the daily goal (1850 kcal)
    const initialCalorieText = await track.calorieRing.textContent();
    expect(initialCalorieText).toContain("1850");

    // ── Step 3: Verify old FoodSection and FluidSection are NOT visible ──
    const oldFoodInput = page.getByPlaceholder("eg. Ham sandwich");
    await expect(oldFoodInput).not.toBeVisible();

    const fluidSections = page.locator('section:has(> header:has-text("Fluids"))');
    expect(await fluidSections.count()).toBe(0);

    // ── Step 4: Type "white rice" in search — verify results appear below water bar ──
    await track.openSearch("white rice");

    const riceResult = track.getSearchResult(/white rice/i);
    await expect(riceResult).toBeVisible();

    // Search results should appear BELOW the water bar (both visible simultaneously)
    await expect(track.calorieRing).toBeVisible();
    await expect(track.waterProgress).toBeVisible();

    // ── Step 5: Verify "Logging to:" label is visible ──────────────────
    await expect(track.mealSlotLabel).toBeVisible();
    await expect(track.mealSlotLabel).toContainText("Logging to:");
    const labelText = await track.mealSlotLabel.textContent();
    expect(labelText).toMatch(/Logging to: (Breakfast|Lunch|Dinner|Snack)/);

    // ── Step 6: Click a result — verify staging badge updates on Log Food button ──
    await track.addSearchResultToStaging(/white rice/i);
    await track.waitForLogFoodButtonText("1");

    // ── Step 7: Click Log Food button — verify staging modal opens ──────
    await track.openLogFoodModal();

    const modal = track.logFoodModal;
    await expect(modal).toHaveAttribute("role", "dialog");

    // ── Step 8: Verify amount shows in g, verify +/- step behavior ──────
    const foodItem = modal.locator('[data-slot="log-food-item"]');
    await expect(foodItem).toBeVisible();
    await expect(foodItem).toContainText("White Rice");
    await expect(foodItem).toContainText("180g");
    await expect(foodItem).toContainText("kcal");

    const decreaseButton = modal.getByLabel(/Decrease.*portion/i);
    await expect(decreaseButton).toBeVisible();

    const increaseButton = modal.getByLabel(/Increase.*portion/i);
    await expect(increaseButton).toBeVisible();

    // ── Step 9: Click + — verify amount increases ───────────────────────
    const portionTextBefore = await foodItem.textContent();
    await increaseButton.click();

    const portionTextAfter = await foodItem.textContent();
    expect(portionTextAfter).not.toEqual(portionTextBefore);
    await expect(foodItem).toContainText("g");

    // ── Step 10: Click Log Food in modal — verify food logged, staging clears, calorie ring updates ──
    const preLogCalorieText = await track.calorieRing.textContent();

    const logButton = modal
      .locator('[data-slot="log-food-actions"]')
      .getByText("Log Food", { exact: true });
    await logButton.click();

    await expect(modal).not.toBeVisible();
    await track.waitForTextChange(track.calorieRing, preLogCalorieText);
    await expect(track.searchInput).toHaveValue("");

    // ── Step 11: Open water modal — verify ring shows, verify increment step ──
    await track.openWaterModal();

    const waterModal = track.waterModal;
    await expect(waterModal).toBeVisible();

    const waterRing = waterModal.locator('[data-slot="water-modal-ring"]');
    await expect(waterRing).toBeVisible();

    const amountSelector = waterModal.locator('[data-slot="water-modal-amount"]');
    const amountInput = waterModal.locator('input[aria-label="Amount to add in millilitres"]');
    await expect(amountSelector).toBeVisible();
    await expect(amountSelector).toContainText("ml");

    const initialWaterAmountText = await amountInput.inputValue();
    const waterIncreaseButton = waterModal.locator('button[aria-label="Increase amount"]');
    await waterIncreaseButton.click();

    const updatedWaterAmountText = await amountInput.inputValue();
    expect(updatedWaterAmountText).not.toEqual(initialWaterAmountText);

    // ── Step 12: Log water — verify water progress bar updates ──────────
    const preWaterProgressText = await track.waterProgress.textContent();
    const logWaterButton = waterModal.getByRole("button", { name: "Log Water" });
    await logWaterButton.click();

    await expect(waterModal).not.toBeVisible();
    await track.waitForTextChange(track.waterProgress, preWaterProgressText);

    // ── Step 13: Tap calorie ring — verify calorie detail expands BELOW the card ──
    await track.calorieRing.click();

    const calorieDetail = track.nutritionCard.locator('[data-slot="calorie-detail"]');
    await expect(calorieDetail).toBeVisible();
    await expect(track.calorieRing).toBeVisible();

    // ── Step 14: Verify per-food macros show 5 values (P, C, F, S, Fi pattern) ──
    const macroLine = calorieDetail.locator('li:has-text("g")').filter({
      has: page.locator(':text-matches("\\d+g.*P.*C.*F.*S.*Fi")'),
    });

    const macroLineCount = await macroLine.count();
    if (macroLineCount === 0) {
      const accordionText = await calorieDetail.textContent();
      expect(accordionText).toContain("g P");
      expect(accordionText).toContain("g C");
      expect(accordionText).toContain("g F");
      expect(accordionText).toContain("g S");
      expect(accordionText).toContain("g Fi");
    }

    // ── Step 15: Search for a liquid food ("clear broth") — verify portion display ──
    await page.keyboard.press("Escape");
    await track.openSearch("clear broth");

    const brothResult = track.getSearchResult(/clear broth/i);
    await expect(brothResult).toBeVisible();

    const brothText = await brothResult.textContent();
    expect(brothText).toMatch(/clear broth/i);
    expect(brothText).toContain("kcal");

    await track.addSearchResultToStaging(/clear broth/i);
    await track.waitForLogFoodButtonText("1");
    await track.openLogFoodModal();

    const brothItem = track.logFoodModal.locator('[data-slot="log-food-item"]');
    await expect(brothItem).toBeVisible();
    await expect(brothItem).toContainText(/clear broth/i);

    const brothPortionText = await brothItem.textContent();
    expect(brothPortionText).toMatch(/\d+(g|ml)/);

    const closeButton = page.getByLabel("Close Log Food modal");
    await closeButton.click();
    await expect(track.logFoodModal).not.toBeVisible();
  });
});

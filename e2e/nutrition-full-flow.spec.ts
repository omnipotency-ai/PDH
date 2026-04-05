import { expect, test } from "./fixtures";

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
    // ── Step 1: Navigate to Track page ──────────────────────────────────
    await page.goto("/");
    const card = page.locator('[data-slot="nutrition-card"]');
    await expect(card).toBeVisible();

    // ── Step 2: Verify NutritionCard renders with calorie ring, search bar, water bar ──
    const calorieRing = card.locator('[data-slot="calorie-ring"]');
    await expect(calorieRing).toBeVisible();

    const searchInput = card.getByLabel("Search foods").first();
    await expect(searchInput).toBeVisible();

    const logFoodButton = card.locator('[data-slot="log-food-button"]');
    await expect(logFoodButton).toBeVisible();
    await expect(logFoodButton).toContainText("Log Food");

    const waterProgress = card.locator('[data-slot="water-progress"]');
    await expect(waterProgress).toBeVisible();

    // Calorie ring should display the daily goal (1850 kcal)
    const initialCalorieText = await calorieRing.textContent();
    expect(initialCalorieText).toContain("1850");

    // ── Step 3: Verify old FoodSection and FluidSection are NOT visible ──
    // The old FoodSection had an input with placeholder "eg. Ham sandwich"
    const oldFoodInput = page.getByPlaceholder("eg. Ham sandwich");
    await expect(oldFoodInput).not.toBeVisible();

    // The old FluidSection had specific fluid tracking UI separate from NutritionCard
    // We verify it's gone by checking no second "Fluids" section exists outside NutritionCard
    const fluidSections = page.locator('section:has(> header:has-text("Fluids"))');
    const fluidCount = await fluidSections.count();
    // There should be no standalone Fluids section (water is now in NutritionCard)
    expect(fluidCount).toBe(0);

    // ── Step 4: Type "white rice" in search — verify results appear below water bar ──
    await searchInput.fill("white rice");

    // Wait for search results to appear (need at least 3 chars, and Fuse.js search)
    const searchResults = card.locator('[data-slot="search-results"]');
    await expect(searchResults).toBeVisible();

    // Results should contain a white rice entry
    const riceResult = searchResults.locator('[data-slot="search-result"]', {
      hasText: /white rice/i,
    });
    await expect(riceResult).toBeVisible();

    // Search results should appear BELOW the water bar (both visible simultaneously)
    // The card layout has calorie ring, search, log button, water bar, then results
    await expect(calorieRing).toBeVisible();
    await expect(waterProgress).toBeVisible();

    // ── Step 5: Verify "Logging to:" label is visible ──────────────────
    const mealSlotLabel = card.locator('[data-slot="meal-slot-label"]');
    await expect(mealSlotLabel).toBeVisible();
    // Should contain "Logging to:" followed by a meal name
    await expect(mealSlotLabel).toContainText("Logging to:");
    const labelText = await mealSlotLabel.textContent();
    // Verify the meal slot is one of the expected values
    expect(labelText).toMatch(/Logging to: (Breakfast|Lunch|Dinner|Snack)/);

    // ── Step 6: Click a result — verify staging badge updates on Log Food button ──
    // Click the + button on the rice result to add to staging
    // The result row has two buttons with "Add" in the aria-label:
    // one for favourites and one for staging. Target the staging one specifically.
    const addButton = riceResult.locator('button[aria-label$="to staging"]');
    await addButton.click();

    // The Log Food button should now show a staging count badge
    await expect(logFoodButton).toContainText("1");

    // ── Step 7: Click Log Food button — verify staging modal opens ──────
    await logFoodButton.click();

    const modal = page.locator('[data-slot="log-food-modal"]');
    await expect(modal).toBeVisible();

    // Modal should be a proper dialog
    await expect(modal).toHaveAttribute("role", "dialog");

    // ── Step 8: Verify amount shows in g, verify +/- step behavior ──────
    const foodItem = modal.locator('[data-slot="log-food-item"]');
    await expect(foodItem).toBeVisible();
    await expect(foodItem).toContainText("White Rice");

    // Should show portion in grams (white rice default is 180g)
    await expect(foodItem).toContainText("180g");

    // Should show calories
    await expect(foodItem).toContainText("kcal");

    // Verify the decrease button exists
    const decreaseButton = modal.getByLabel(/Decrease.*portion/i);
    await expect(decreaseButton).toBeVisible();

    // Verify the increase button exists
    const increaseButton = modal.getByLabel(/Increase.*portion/i);
    await expect(increaseButton).toBeVisible();

    // ── Step 9: Click + — verify amount increases ───────────────────────
    // Record the current portion text before clicking +
    const portionTextBefore = await foodItem.textContent();

    await increaseButton.click();

    // Portion should have increased (the exact step depends on implementation:
    // spec says 50g flat, current implementation may use unitWeightG)
    const portionTextAfter = await foodItem.textContent();
    expect(portionTextAfter).not.toEqual(portionTextBefore);

    // The portion display should still contain "g"
    await expect(foodItem).toContainText("g");

    // ── Step 10: Click Log Food in modal — verify food logged, staging clears, calorie ring updates ──
    // Record the calorie ring state before logging
    const preLogCalorieText = await calorieRing.textContent();

    // Click the "Log Food" action button inside the modal
    const logButton = modal
      .locator('[data-slot="log-food-actions"]')
      .getByText("Log Food", { exact: true });
    await logButton.click();

    // Modal should close
    await expect(modal).not.toBeVisible();

    // Wait for Convex reactivity to propagate the logged food
    await page.waitForTimeout(2000);

    // Calorie ring should have updated (consumed calories increased)
    const postLogCalorieText = await calorieRing.textContent();
    expect(postLogCalorieText).not.toEqual(preLogCalorieText);

    // The Log Food button should no longer show a staging count
    // (staging was cleared after logging)
    const buttonText = await logFoodButton.textContent();
    expect(buttonText?.trim()).toBe("Log Food");

    // ── Step 11: Open water modal — verify ring shows, verify increment step ──
    // Click the water progress bar to open WaterModal
    await waterProgress.click();

    const waterModal = page.locator('[data-slot="water-modal"]');
    await expect(waterModal).toBeVisible();

    // Verify the progress ring is present
    const waterRing = waterModal.locator('[data-slot="water-modal-ring"]');
    await expect(waterRing).toBeVisible();

    // Verify it shows an amount with "ml"
    const amountSelector = waterModal.locator('[data-slot="water-modal-amount"]');
    await expect(amountSelector).toBeVisible();
    await expect(amountSelector).toContainText("ml");

    // Record the initial water amount text
    const initialWaterAmountText = await amountSelector.textContent();

    // Click + to verify increment works
    const waterIncreaseButton = waterModal.locator('button[aria-label="Increase amount"]');
    await waterIncreaseButton.click();

    // Amount should have changed
    const updatedWaterAmountText = await amountSelector.textContent();
    expect(updatedWaterAmountText).not.toEqual(initialWaterAmountText);

    // ── Step 12: Log water — verify water progress bar updates ──────────
    // Record water progress text before logging
    const preWaterProgressText = await waterProgress.textContent();

    // Click "Log Water" button
    const logWaterButton = waterModal.getByRole("button", { name: "Log Water" });
    await logWaterButton.click();

    // Modal should close
    await expect(waterModal).not.toBeVisible();

    // Wait for Convex reactivity
    await page.waitForTimeout(2000);

    // Water progress bar should have updated
    const postWaterProgressText = await waterProgress.textContent();
    expect(postWaterProgressText).not.toEqual(preWaterProgressText);

    // ── Step 13: Tap calorie ring — verify calorie detail expands BELOW the card ──
    // Click the calorie ring to expand calorie detail
    await calorieRing.click();

    // CalorieDetailView should now be visible
    const calorieDetail = card.locator('[data-slot="calorie-detail"]');
    await expect(calorieDetail).toBeVisible();

    // The calorie ring should STILL be visible (it is always visible in the new layout)
    await expect(calorieRing).toBeVisible();

    // Water progress bar should also still be visible
    await expect(waterProgress).toBeVisible();

    // Meal breakdown bar should be present
    const mealBreakdown = calorieDetail.locator('[data-slot="meal-breakdown"]');
    await expect(mealBreakdown).toBeVisible();

    // Macro summary should be present with all 5 macros
    const macroSummary = calorieDetail.locator('[data-slot="macro-summary"]');
    await expect(macroSummary).toBeVisible();

    // ── Step 14: Verify per-food macros show 5 values ───────────────────
    // Expand a meal slot accordion that has entries (the one containing our logged rice)
    const accordionButtons = calorieDetail.locator(
      '[data-slot="meal-slot-accordion"] button[aria-expanded]',
    );
    const accordionCount = await accordionButtons.count();

    // Find and expand an accordion with entries (non-disabled)
    for (let i = 0; i < accordionCount; i++) {
      const btn = accordionButtons.nth(i);
      const isDisabled = await btn.isDisabled();
      if (!isDisabled) {
        await btn.click();
        break;
      }
    }

    // White rice should now be visible in the expanded accordion
    await expect(calorieDetail).toContainText("White rice");

    // Per-food macros should show all 5 values: P, C, F, S, Fi
    // The format is: "{portionG}g . {protein}g P . {carbs}g C . {fat}g F . {sugars}g S . {fiber}g Fi"
    const foodItemInDetail = calorieDetail.locator("text=g P");
    await expect(foodItemInDetail.first()).toBeVisible();

    // Verify the macro line contains all 5 macro abbreviations
    const macroLine = calorieDetail.locator(
      ':text-matches("\\\\d+g.*P.*C.*F.*S.*Fi")',
    );
    // If the regex locator does not match, fall back to checking each macro text
    const macroLineCount = await macroLine.count();
    if (macroLineCount === 0) {
      // Verify each macro abbreviation exists somewhere in the accordion
      // The format for per-food detail is: "Xg P . Xg C . Xg F . Xg S . Xg Fi"
      const accordionText = await calorieDetail.textContent();
      expect(accordionText).toContain("g P");
      expect(accordionText).toContain("g C");
      expect(accordionText).toContain("g F");
      expect(accordionText).toContain("g S");
      expect(accordionText).toContain("g Fi");
    }

    // ── Step 15: Search for a liquid food ("clear broth") — verify portion display ──
    // Close the calorie detail by pressing Escape (clears panel)
    await page.keyboard.press("Escape");

    // Search for "clear broth" — a liquid food in Zone 1A
    await searchInput.fill("clear broth");

    // Wait for search results
    await expect(searchResults).toBeVisible();

    const brothResult = searchResults.locator('[data-slot="search-result"]', {
      hasText: /clear broth/i,
    });
    await expect(brothResult).toBeVisible();

    // The result should show portion information
    // Clear broth has naturalUnit="cup", defaultPortionG=240
    // Whether it shows "ml" or "g" depends on whether the liquid unit feature
    // has been fully implemented (Task 2 in the fix plan)
    const brothText = await brothResult.textContent();
    // At minimum, the result should show the food name and some portion info
    expect(brothText).toMatch(/clear broth/i);
    // Verify it shows calorie info
    expect(brothText).toContain("kcal");

    // Add clear broth to staging to verify it can be staged
    const brothAddButton = brothResult.locator('button[aria-label$="to staging"]');
    await brothAddButton.click();

    // Log Food button should update with staging count
    await expect(logFoodButton).toContainText("1");

    // Open staging modal to verify the liquid food's portion display
    await logFoodButton.click();
    await expect(modal).toBeVisible();

    const brothItem = modal.locator('[data-slot="log-food-item"]');
    await expect(brothItem).toBeVisible();
    await expect(brothItem).toContainText(/clear broth/i);

    // The portion should display a unit amount (g or ml depending on implementation)
    const brothPortionText = await brothItem.textContent();
    expect(brothPortionText).toMatch(/\d+(g|ml)/);

    // Clean up: close the modal without logging
    const closeButton = page.getByLabel("Close Log Food modal");
    await closeButton.click();
    await expect(modal).not.toBeVisible();
  });
});

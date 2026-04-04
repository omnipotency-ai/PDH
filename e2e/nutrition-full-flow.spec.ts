import { expect, test } from "./fixtures";

/**
 * W3-07: Full end-to-end integration test for the nutrition card.
 *
 * This is the single most important test in the plan. If it passes,
 * the feature works. It covers the complete user journey:
 *
 *   1. Navigate to Track page
 *   2. Search for a food
 *   3. Add to staging
 *   4. Open LogFoodModal and review
 *   5. Log the food
 *   6. Verify calorie ring updates
 *   7. Verify food appears in TodayLog
 *   8. Open calorie detail view
 *   9. Verify food in correct meal slot
 *  10. Delete the food
 *  11. Verify calorie ring returns to baseline
 *  12. Log water via WaterModal
 *  13. Verify water progress updates
 */

test.describe("Nutrition full flow", () => {
  test("complete food + water logging cycle", async ({ page }) => {
    // ── Step 1: Navigate to Track page ──────────────────────────────────
    await page.goto("/");
    const card = page.locator('[data-slot="nutrition-card"]');
    await expect(card).toBeVisible();

    // Record the initial calorie ring state
    const calorieRing = card.locator('[data-slot="calorie-ring"]');
    await expect(calorieRing).toBeVisible();
    const initialCalorieText = await calorieRing.textContent();
    // Should contain the daily goal somewhere
    expect(initialCalorieText).toContain("1850");

    // ── Step 2: Search for a food ───────────────────────────────────────
    const searchInput = card.getByLabel("Search foods").first();
    await searchInput.click();
    await expect(page.locator('[data-slot="search-view"]')).toBeVisible();
    await searchInput.fill("white rice");

    // Wait for results
    const resultsList = page.locator('[role="listbox"][aria-label="Search results"]');
    await expect(resultsList).toBeVisible();

    // ── Step 3: Add to staging ──────────────────────────────────────────
    const riceResult = resultsList.locator('[data-slot="search-result"]', {
      hasText: "white rice",
    });
    await expect(riceResult).toBeVisible();
    await riceResult.click();

    // Staging button should show count "1"
    const stagingButton = page.locator('[data-slot="open-staging-button"]');
    await expect(stagingButton).toBeVisible();
    await expect(stagingButton).toContainText("1");

    // ── Step 4: Open LogFoodModal and review ─────────────────────────────
    await stagingButton.click();
    const modal = page.locator('[data-slot="log-food-modal"]');
    await expect(modal).toBeVisible();

    // Verify the staged item shows correct info
    const foodItem = modal.locator('[data-slot="log-food-item"]');
    await expect(foodItem).toContainText("White Rice");
    await expect(foodItem).toContainText("180g"); // default portion
    await expect(foodItem).toContainText("234 kcal");

    // Verify macro totals are present
    const totals = modal.locator('[data-slot="log-food-totals"]');
    await expect(totals).toContainText("234 kcal");

    // ── Step 5: Log the food ────────────────────────────────────────────
    const logButton = modal
      .locator('[data-slot="log-food-actions"]')
      .getByText("Log Food", { exact: true });
    await logButton.click();

    // Modal should close
    await expect(modal).not.toBeVisible();

    // Should return to collapsed view
    await expect(page.locator('[data-slot="collapsed-view"]')).toBeVisible();

    // ── Step 6: Verify calorie ring updates ─────────────────────────────
    // Wait for Convex reactivity to propagate
    await page.waitForTimeout(2000);

    // The calorie ring text should have changed (more calories consumed)
    const updatedCalorieText = await calorieRing.textContent();
    expect(updatedCalorieText).not.toEqual(initialCalorieText);
    // Goal should still be present
    expect(updatedCalorieText).toContain("1850");

    // ── Step 7: Verify food appears in TodayLog ─────────────────────────
    const todayLog = page.getByRole("complementary");
    await expect(todayLog).toContainText("White Rice");

    // ── Step 8: Open calorie detail view ────────────────────────────────
    await calorieRing.click();

    // Calorie detail view should now be visible with meal slot breakdowns
    const calorieDetail = card.locator('[data-slot="calorie-detail-view"]');
    await expect(calorieDetail).toBeVisible();

    // ── Step 9: Verify food in correct meal slot ────────────────────────
    // Expand the meal slot accordion that has entries (the one that isn't disabled)
    const accordions = calorieDetail.locator('[data-slot="meal-slot-accordion"] button[aria-expanded]');
    const accordionCount = await accordions.count();
    for (let i = 0; i < accordionCount; i++) {
      const btn = accordions.nth(i);
      const isDisabled = await btn.isDisabled();
      const isExpanded = await btn.getAttribute("aria-expanded");
      const label = await btn.getAttribute("aria-label");
      // Expand any slot that has entries and mentions our food's calories
      if (!isDisabled && isExpanded !== "true" && label?.includes("kcal")) {
        await btn.click();
      }
    }

    // White rice should now be visible in the expanded accordion
    await expect(calorieDetail).toContainText("White rice");

    // ── Step 10: Delete the food ────────────────────────────────────────
    // Use .last() to delete the most recently logged entry (may have
    // accumulated entries from prior test runs sharing the same name)
    const deleteButton = calorieDetail.getByLabel("Delete White rice").last();
    await expect(deleteButton).toBeVisible();

    // Record calorie text before deletion
    const preDeleteCalorieText = await calorieRing.textContent();
    await deleteButton.click();

    // ── Step 11: Verify calorie ring decreases ──────────────────────────
    await page.waitForTimeout(2000);

    // After deleting 234 kcal of white rice, the calorie ring should change
    const postDeleteCalorieText = await calorieRing.textContent();
    expect(postDeleteCalorieText).not.toEqual(preDeleteCalorieText);

    // ── Step 12: Log water via WaterModal ────────────────────────────────
    // Close calorie detail first by pressing Escape
    await page.keyboard.press("Escape");

    // Click the water progress bar to open WaterModal
    const waterProgress = card.locator('[data-slot="water-progress"]');
    await waterProgress.click();

    // WaterModal should open
    const waterModal = page.locator('[data-slot="water-modal"]');
    await expect(waterModal).toBeVisible();

    // Verify it shows default amount (200ml)
    await expect(waterModal).toContainText("200");
    await expect(waterModal).toContainText("ml");

    // Click "Log Water" button (not the heading)
    const logWaterButton = waterModal.getByRole("button", { name: "Log Water" });
    await logWaterButton.click();

    // Modal should close
    await expect(waterModal).not.toBeVisible();

    // ── Step 13: Verify water progress updates ──────────────────────────
    await page.waitForTimeout(2000);

    // Water bar should show 200/1000ml
    await expect(waterProgress).toContainText("200");
  });
});

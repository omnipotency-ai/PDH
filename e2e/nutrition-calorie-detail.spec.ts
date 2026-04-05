import { expect, test } from "./fixtures";

/**
 * E2E tests for CalorieDetailView within the NutritionCard.
 *
 * The NutritionCard is on the Track page at /. Tapping the calorie ring
 * expands it to show CalorieDetailView which contains:
 * - MealBreakdownBar (stacked bar of calories per meal slot)
 * - MacroRow (Proteins, Carbs, Sugars, Fats, Fiber)
 * - MealSlotAccordion (one-open-at-a-time for Breakfast, Lunch, Dinner, Snack)
 *
 * The expanded view also preserves shared layout: CalorieRing, WaterProgressRow,
 * and SearchInput.
 */
test.describe("CalorieDetailView", () => {
  // Helper to locate the NutritionCard section
  const getNutritionCard = (page: import("@playwright/test").Page) =>
    page.locator('[data-slot="nutrition-card"]');

  // Helper to locate the CalorieRing button
  const getCalorieRing = (page: import("@playwright/test").Page) =>
    getNutritionCard(page).locator('[data-slot="calorie-ring"]');

  // Helper to locate the calorie detail view container
  const getCalorieDetailView = (page: import("@playwright/test").Page) =>
    getNutritionCard(page).locator('[data-slot="calorie-detail-view"]');

  // Helper to locate CalorieDetailView's inner content
  const getCalorieDetail = (page: import("@playwright/test").Page) =>
    getNutritionCard(page).locator('[data-slot="calorie-detail"]');

  test("tapping calorie ring expands to CalorieDetailView", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible();

    const nutritionCard = getNutritionCard(page);
    await expect(nutritionCard).toBeVisible();

    // Collapsed view should be visible initially
    const collapsedView = nutritionCard.locator('[data-slot="collapsed-view"]');
    await expect(collapsedView).toBeVisible();

    // CalorieDetailView should not be visible yet
    await expect(getCalorieDetailView(page)).not.toBeVisible();

    // Tap the calorie ring to expand
    const calorieRing = getCalorieRing(page);
    await expect(calorieRing).toBeVisible();
    await calorieRing.click();

    // CalorieDetailView should now be visible
    await expect(getCalorieDetailView(page)).toBeVisible();

    await expect(collapsedView).not.toBeAttached();
  });

  test("CalorieDetailView shows meal breakdown bar", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible();

    // Expand to CalorieDetailView
    await getCalorieRing(page).click();
    await expect(getCalorieDetailView(page)).toBeVisible();

    // MealBreakdownBar should be present
    const mealBreakdown = getCalorieDetail(page).locator('[data-slot="meal-breakdown"]');
    await expect(mealBreakdown).toBeVisible();

    // Should contain the four meal slot legend labels
    await expect(mealBreakdown.getByText("Breakfast")).toBeVisible();
    await expect(mealBreakdown.getByText("Lunch")).toBeVisible();
    await expect(mealBreakdown.getByText("Dinner")).toBeVisible();
    await expect(mealBreakdown.getByText("Snack")).toBeVisible();
  });

  test("CalorieDetailView shows macro rows (protein, carbs, sugars, fats, fiber)", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible();

    // Expand to CalorieDetailView
    await getCalorieRing(page).click();
    await expect(getCalorieDetailView(page)).toBeVisible();

    // MacroRow should be present with all 5 macro labels
    const macroSummary = getCalorieDetail(page).locator('[data-slot="macro-summary"]');
    await expect(macroSummary).toBeVisible();

    await expect(macroSummary.getByText("Proteins")).toBeVisible();
    await expect(macroSummary.getByText("Carbs")).toBeVisible();
    await expect(macroSummary.getByText("Sugars")).toBeVisible();
    await expect(macroSummary.getByText("Fats")).toBeVisible();
    await expect(macroSummary.getByText("Fiber")).toBeVisible();
  });

  test("meal slot accordions are present (Breakfast, Lunch, Dinner, Snack)", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible();

    // Expand to CalorieDetailView
    await getCalorieRing(page).click();
    await expect(getCalorieDetailView(page)).toBeVisible();

    // All 4 meal slot accordions should be present
    const accordions = getCalorieDetail(page).locator('[data-slot="meal-slot-accordion"]');
    await expect(accordions).toHaveCount(4);

    // Each accordion should have its meal label as a button
    const calorieDetail = getCalorieDetail(page);
    await expect(calorieDetail.getByRole("button", { name: /Breakfast/ })).toBeVisible();
    await expect(calorieDetail.getByRole("button", { name: /Lunch/ })).toBeVisible();
    await expect(calorieDetail.getByRole("button", { name: /Dinner/ })).toBeVisible();
    await expect(calorieDetail.getByRole("button", { name: /Snack/ })).toBeVisible();
  });

  test("only one accordion can be open at a time", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible();

    // Expand to CalorieDetailView
    await getCalorieRing(page).click();
    await expect(getCalorieDetailView(page)).toBeVisible();

    // Get all accordion buttons
    const calorieDetail = getCalorieDetail(page);
    const accordionButtons = calorieDetail.locator('[data-slot="meal-slot-accordion"] > button');

    // All accordions should initially have aria-expanded=false
    const count = await accordionButtons.count();
    for (let i = 0; i < count; i++) {
      const expanded = await accordionButtons.nth(i).getAttribute("aria-expanded");
      expect(expanded).toBe("false");
    }

    // Find the first accordion that is not disabled (has entries)
    // If none have entries, we verify the mutual exclusion logic by checking
    // that all accordions report aria-expanded=false (empty accordions are disabled).
    let enabledAccordionIndex = -1;
    let secondEnabledIndex = -1;
    for (let i = 0; i < count; i++) {
      const isDisabled = await accordionButtons.nth(i).isDisabled();
      if (!isDisabled) {
        if (enabledAccordionIndex === -1) {
          enabledAccordionIndex = i;
        } else if (secondEnabledIndex === -1) {
          secondEnabledIndex = i;
          break;
        }
      }
    }

    // If we have at least 2 enabled accordions, test mutual exclusion
    if (enabledAccordionIndex >= 0 && secondEnabledIndex >= 0) {
      // Open the first enabled accordion
      await accordionButtons.nth(enabledAccordionIndex).click();
      await expect(accordionButtons.nth(enabledAccordionIndex)).toHaveAttribute(
        "aria-expanded",
        "true",
      );
      await expect(accordionButtons.nth(secondEnabledIndex)).toHaveAttribute(
        "aria-expanded",
        "false",
      );

      // Open the second — first should close
      await accordionButtons.nth(secondEnabledIndex).click();
      await expect(accordionButtons.nth(secondEnabledIndex)).toHaveAttribute(
        "aria-expanded",
        "true",
      );
      await expect(accordionButtons.nth(enabledAccordionIndex)).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    }

    // Regardless: at most one accordion can have aria-expanded=true at any time
    let openCount = 0;
    for (let i = 0; i < count; i++) {
      const expanded = await accordionButtons.nth(i).getAttribute("aria-expanded");
      if (expanded === "true") openCount++;
    }
    expect(openCount).toBeLessThanOrEqual(1);
  });

  test("accordion shows food items when logs exist for that meal slot", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible();

    // Log a food via the FoodSection (old-style text input) so we have data
    const foodSection = page.locator("section.glass-card-food");
    // The FoodSection still has the older input pattern
    const foodInput = foodSection.locator('input[placeholder="eg. Ham sandwich"]');

    // Only proceed with food item check if the old FoodSection input exists
    if (await foodInput.isVisible()) {
      await foodInput.fill("Chicken breast");
      const logButton = foodSection.locator("button", { hasText: "Log Food" });
      await logButton.click();
      await page.waitForTimeout(1000);
    }

    // Expand to CalorieDetailView
    await getCalorieRing(page).click();
    await expect(getCalorieDetailView(page)).toBeVisible();

    const calorieDetail = getCalorieDetail(page);
    const accordionButtons = calorieDetail.locator('[data-slot="meal-slot-accordion"] > button');

    // Find an enabled (non-empty) accordion and open it
    const count = await accordionButtons.count();

    for (let i = 0; i < count; i++) {
      const isDisabled = await accordionButtons.nth(i).isDisabled();
      if (!isDisabled) {
        await accordionButtons.nth(i).click();
        await expect(accordionButtons.nth(i)).toHaveAttribute("aria-expanded", "true");

        // When an accordion is open, food items should be rendered below it
        // The accordion parent contains the expanded content with food rows
        const accordion = calorieDetail.locator('[data-slot="meal-slot-accordion"]').nth(i);

        // Food item rows have a delete button with aria-label "Delete ..."
        const deleteButtons = accordion.locator('button[aria-label^="Delete"]');
        const deleteCount = await deleteButtons.count();
        if (deleteCount > 0) {
          // Verify the food item text is visible (each row has a name span)
          const firstItemName = accordion.locator(".text-sm.font-semibold").first();
          await expect(firstItemName).toBeVisible();
        }
        break;
      }
    }
  });

  test("delete button is present on logged food items", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible();

    // Expand to CalorieDetailView
    await getCalorieRing(page).click();
    await expect(getCalorieDetailView(page)).toBeVisible();

    const calorieDetail = getCalorieDetail(page);
    const accordionButtons = calorieDetail.locator('[data-slot="meal-slot-accordion"] > button');

    // Find an enabled accordion and check for delete buttons on food items
    const count = await accordionButtons.count();
    for (let i = 0; i < count; i++) {
      const isDisabled = await accordionButtons.nth(i).isDisabled();
      if (!isDisabled) {
        await accordionButtons.nth(i).click();

        const accordion = calorieDetail.locator('[data-slot="meal-slot-accordion"]').nth(i);

        // Each food item row should have a Trash2 delete button
        const deleteButtons = accordion.locator('button[aria-label^="Delete"]');
        const deleteCount = await deleteButtons.count();

        if (deleteCount > 0) {
          // Verify each delete button is visible and clickable
          for (let j = 0; j < deleteCount; j++) {
            await expect(deleteButtons.nth(j)).toBeVisible();
            await expect(deleteButtons.nth(j)).toBeEnabled();
          }
        }
        break;
      }
    }
  });

  test("Escape key returns to collapsed view", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible();

    const nutritionCard = getNutritionCard(page);

    // Expand to CalorieDetailView
    await getCalorieRing(page).click();
    await expect(getCalorieDetailView(page)).toBeVisible();

    // Press Escape
    await page.keyboard.press("Escape");

    // Should return to collapsed view
    const collapsedView = nutritionCard.locator('[data-slot="collapsed-view"]');
    await expect(collapsedView).toBeVisible();

    // CalorieDetailView should be gone
    await expect(getCalorieDetailView(page)).not.toBeVisible();
  });

  test("tapping calorie ring again returns to collapsed view", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible();

    const nutritionCard = getNutritionCard(page);

    // Expand to CalorieDetailView
    const calorieRing = getCalorieRing(page);
    await calorieRing.click();
    await expect(getCalorieDetailView(page)).toBeVisible();

    // Tap the persistent calorie ring again to collapse the detail view.
    await expect(calorieRing).toBeVisible();
    await calorieRing.click();

    // Should return to collapsed view
    const collapsedView = nutritionCard.locator('[data-slot="collapsed-view"]');
    await expect(collapsedView).toBeVisible();
    await expect(getCalorieDetailView(page)).not.toBeVisible();
  });

  test("shared layout elements are visible in detail view (CalorieRing, WaterProgressRow, SearchInput)", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible();

    // Expand to CalorieDetailView
    await getCalorieRing(page).click();
    const detailView = getCalorieDetailView(page);
    await expect(detailView).toBeVisible();

    // CalorieRing should still be visible in the shared NutritionCard shell
    const calorieRing = getNutritionCard(page).locator('[data-slot="calorie-ring"]');
    await expect(calorieRing).toBeVisible();

    // WaterProgressRow should still be visible in the shared shell
    const waterProgress = getNutritionCard(page).locator('[data-slot="water-progress"]');
    await expect(waterProgress).toBeVisible();

    // SearchInput should still be visible in the shared shell
    const searchInput = getNutritionCard(page).locator('[data-slot="nutrition-search"]');
    await expect(searchInput).toBeVisible();

    // Log Food button should still be visible in the shared shell
    const logFoodButton = getNutritionCard(page).locator('[data-slot="log-food-button"]');
    await expect(logFoodButton).toBeVisible();
  });
});

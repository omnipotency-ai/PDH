import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/**
 * E2E tests for FavouritesView and FoodFilterView in the NutritionCard.
 *
 * Prerequisites:
 * - Dev server on :3005 with Convex backend
 * - Clerk auth (auth.setup.ts)
 *
 * Selector strategy:
 *   nutrition-card     — data-slot="nutrition-card" on the <section>. Stable.
 *   favourites-btn     — aria-label="Favourites" on the header heart icon. Stable.
 *   filter-btn         — aria-label="Filter foods" on the header sliders icon. Stable.
 *   favourites-view    — data-slot="favourites-view". Stable.
 *   food-filter-view   — data-slot="food-filter-view". Stable.
 *   filter-tabs        — data-slot="filter-tabs" with role="tablist". Stable.
 *   favourite-row      — data-slot="favourite-row" on each favourite list item. Stable.
 *   food-filter-row    — data-slot="food-filter-row" on each filter list item. Stable.
 *   collapsed-view     — data-slot="collapsed-view" on the default card state. Stable.
 *   back-btn           — aria-label="Back to nutrition card". Stable.
 *   log-food-button    — data-slot="log-food-button" on the orange "Log Food" button. Stable.
 */

// ── Selectors ───────────────────────────────────────────────────────────────

const SEL = {
  root: "#root",
  nutritionCard: '[data-slot="nutrition-card"]',
  collapsedView: '[data-slot="collapsed-view"]',
  favouritesButton: 'button[aria-label="Favourites"]',
  filterButton: 'button[aria-label="Filter foods"]',
  favouritesView: '[data-slot="favourites-view"]',
  foodFilterView: '[data-slot="food-filter-view"]',
  filterTabs: '[data-slot="filter-tabs"]',
  favouriteRow: '[data-slot="favourite-row"]',
  foodFilterRow: '[data-slot="food-filter-row"]',
  backButton: 'button[aria-label="Back to nutrition card"]',
  logFoodButton: '[data-slot="log-food-button"]',
} as const;

// ── Helpers ─────────────────────────────────────────────────────────────────

async function navigateAndWait(page: Page) {
  await page.goto("/");
  await expect(page.locator(SEL.root)).toBeVisible();
  // Wait for the nutrition card to render (Convex data may take a moment)
  await expect(page.locator(SEL.nutritionCard)).toBeVisible();
}

// ── FavouritesView Tests ────────────────────────────────────────────────────

test.describe("FavouritesView", () => {
  test("heart icon in header navigates to FavouritesView", async ({ page }) => {
    await navigateAndWait(page);

    // The collapsed view should be visible initially
    await expect(page.locator(SEL.collapsedView)).toBeVisible();

    // Click the heart icon in the NutritionCard header
    const heartButton = page.locator(SEL.nutritionCard).locator(SEL.favouritesButton);
    await expect(heartButton).toBeVisible();
    await heartButton.click();

    // FavouritesView should now be visible
    await expect(page.locator(SEL.favouritesView)).toBeVisible();
    await expect(page.locator(SEL.collapsedView)).not.toBeAttached();
  });

  test("FavouritesView shows favourites list or empty state", async ({ page }) => {
    await navigateAndWait(page);

    // Navigate to favourites
    await page.locator(SEL.nutritionCard).locator(SEL.favouritesButton).click();
    await expect(page.locator(SEL.favouritesView)).toBeVisible();

    // Check for either the favourites list or the empty state message.
    // The user may or may not have favourites configured in their profile.
    const favouriteRows = page.locator(SEL.favouriteRow);
    const emptyMessage = page.locator(SEL.favouritesView).getByText("No favourites yet");

    // One of these must be true: either rows exist or the empty state shows
    const rowCount = await favouriteRows.count();
    if (rowCount === 0) {
      await expect(emptyMessage).toBeVisible();
    } else {
      // If we have favourite rows, the empty state should not be visible
      await expect(emptyMessage).not.toBeVisible();
    }
  });

  test("each favourite row shows food name and portion/calorie info", async ({ page }) => {
    await navigateAndWait(page);

    // Navigate to favourites
    await page.locator(SEL.nutritionCard).locator(SEL.favouritesButton).click();
    await expect(page.locator(SEL.favouritesView)).toBeVisible();

    const favouriteRows = page.locator(SEL.favouriteRow);
    const rowCount = await favouriteRows.count();

    if (rowCount > 0) {
      const firstRow = favouriteRows.first();

      // Each row should have a visible food name (text-sm font-semibold span)
      const foodName = firstRow.locator("span.font-semibold").first();
      await expect(foodName).toBeVisible();
      const nameText = await foodName.textContent();
      expect(nameText).toBeTruthy();
      expect(nameText!.trim().length).toBeGreaterThan(0);

      // Each row should have portion/calorie info (text-xs span)
      const infoSpan = firstRow.locator("span.text-xs").first();
      await expect(infoSpan).toBeVisible();

      // Each row should have an add button with proper aria-label
      const addButton = firstRow.locator('button[aria-label^="Add "]');
      await expect(addButton).toBeVisible();
    }
    // If no favourites, we already verified empty state in the previous test
  });

  test("add button on favourite row adds food to staging", async ({ page }) => {
    await navigateAndWait(page);

    // Navigate to favourites
    await page.locator(SEL.nutritionCard).locator(SEL.favouritesButton).click();
    await expect(page.locator(SEL.favouritesView)).toBeVisible();

    const favouriteRows = page.locator(SEL.favouriteRow);
    const rowCount = await favouriteRows.count();

    if (rowCount > 0) {
      // Click the add button on the first favourite
      const firstRow = favouriteRows.first();
      const addButton = firstRow.locator('button[aria-label^="Add "]');
      await addButton.click();

      // Navigate back to collapsed view to verify staging badge
      await page.locator(SEL.favouritesView).locator(SEL.backButton).click();
      await expect(page.locator(SEL.collapsedView)).toBeVisible();

      // The "Log Food" button should now show a staging count badge
      const logFoodButton = page.locator(SEL.logFoodButton);
      await expect(logFoodButton).toBeVisible();
      // The badge span appears inside the button when stagingCount > 0
      const stagingBadge = logFoodButton.locator("span.rounded-full");
      await expect(stagingBadge).toBeVisible();
      const badgeText = await stagingBadge.textContent();
      expect(Number(badgeText)).toBeGreaterThan(0);
    }
  });

  test("back button returns to collapsed view", async ({ page }) => {
    await navigateAndWait(page);

    // Navigate to favourites
    await page.locator(SEL.nutritionCard).locator(SEL.favouritesButton).click();
    await expect(page.locator(SEL.favouritesView)).toBeVisible();

    // Click the back button
    const backButton = page.locator(SEL.favouritesView).locator(SEL.backButton);
    await expect(backButton).toBeVisible();
    await backButton.click();

    // Should return to collapsed view
    await expect(page.locator(SEL.collapsedView)).toBeVisible();
    await expect(page.locator(SEL.favouritesView)).not.toBeVisible();
  });

  test("escape key returns to collapsed view from favourites", async ({ page }) => {
    await navigateAndWait(page);

    // Navigate to favourites
    await page.locator(SEL.nutritionCard).locator(SEL.favouritesButton).click();
    await expect(page.locator(SEL.favouritesView)).toBeVisible();

    // Press Escape
    await page.keyboard.press("Escape");

    // Should return to collapsed view
    await expect(page.locator(SEL.collapsedView)).toBeVisible();
    await expect(page.locator(SEL.favouritesView)).not.toBeVisible();
  });
});

// ── FoodFilterView Tests ────────────────────────────────────────────────────

test.describe("FoodFilterView", () => {
  test("filter icon in header navigates to FoodFilterView", async ({ page }) => {
    await navigateAndWait(page);

    // The collapsed view should be visible initially
    await expect(page.locator(SEL.collapsedView)).toBeVisible();

    // Click the filter icon in the NutritionCard header
    const filterButton = page.locator(SEL.nutritionCard).locator(SEL.filterButton);
    await expect(filterButton).toBeVisible();
    await filterButton.click();

    // FoodFilterView should now be visible
    await expect(page.locator(SEL.foodFilterView)).toBeVisible();
    await expect(page.locator(SEL.collapsedView)).not.toBeAttached();
  });

  test("FoodFilterView shows three tabs: Recent, Frequent, All", async ({ page }) => {
    await navigateAndWait(page);

    // Navigate to food filter
    await page.locator(SEL.nutritionCard).locator(SEL.filterButton).click();
    await expect(page.locator(SEL.foodFilterView)).toBeVisible();

    // The tab bar should be present with role="tablist"
    const tablist = page.locator(SEL.filterTabs);
    await expect(tablist).toBeVisible();

    // Check all three tab labels are present (Favourites tab removed — redundant with dedicated FavouritesView)
    const tabs = tablist.locator('button[role="tab"]');
    await expect(tabs).toHaveCount(3);

    await expect(tablist.getByText("Recent")).toBeVisible();
    await expect(tablist.getByText("Frequent")).toBeVisible();
    await expect(tablist.getByText("All")).toBeVisible();
  });

  test("Recent tab is active by default", async ({ page }) => {
    await navigateAndWait(page);

    await page.locator(SEL.nutritionCard).locator(SEL.filterButton).click();
    await expect(page.locator(SEL.foodFilterView)).toBeVisible();

    // Recent tab should have aria-selected="true"
    const recentTab = page
      .locator(SEL.filterTabs)
      .locator('button[role="tab"]')
      .filter({ hasText: "Recent" });
    await expect(recentTab).toHaveAttribute("aria-selected", "true");
  });

  test("clicking a tab switches the active tab and shows content", async ({ page }) => {
    await navigateAndWait(page);

    await page.locator(SEL.nutritionCard).locator(SEL.filterButton).click();
    await expect(page.locator(SEL.foodFilterView)).toBeVisible();

    const tablist = page.locator(SEL.filterTabs);

    // Click the "All" tab
    const allTab = tablist.locator('button[role="tab"]').filter({ hasText: "All" });
    await allTab.click();

    // All tab should now be active
    await expect(allTab).toHaveAttribute("aria-selected", "true");

    // Recent tab should no longer be active
    const recentTab = tablist.locator('button[role="tab"]').filter({ hasText: "Recent" });
    await expect(recentTab).toHaveAttribute("aria-selected", "false");

    // The "All" tab should show food items from the full registry
    // (FOOD_PORTION_DATA has 147+ entries, tab shows max 50)
    const foodRows = page.locator(SEL.foodFilterRow);
    await expect(foodRows.first()).toBeVisible({ timeout: 3000 });
    const rowCount = await foodRows.count();
    expect(rowCount).toBeGreaterThan(0);
  });

  test("All tab food items display name and calorie info", async ({ page }) => {
    await navigateAndWait(page);

    await page.locator(SEL.nutritionCard).locator(SEL.filterButton).click();
    await expect(page.locator(SEL.foodFilterView)).toBeVisible();

    // Switch to All tab to guarantee items are shown
    const allTab = page
      .locator(SEL.filterTabs)
      .locator('button[role="tab"]')
      .filter({ hasText: "All" });
    await allTab.click();

    const foodRows = page.locator(SEL.foodFilterRow);
    await expect(foodRows.first()).toBeVisible({ timeout: 3000 });

    const firstRow = foodRows.first();

    // Should have a food name
    const foodName = firstRow.locator("span.font-semibold").first();
    await expect(foodName).toBeVisible();
    const nameText = await foodName.textContent();
    expect(nameText).toBeTruthy();
    expect(nameText!.trim().length).toBeGreaterThan(0);

    // Should have portion/calorie info
    const infoSpan = firstRow.locator("span.text-xs").first();
    await expect(infoSpan).toBeVisible();
    const infoText = await infoSpan.textContent();
    // Should contain either "g" (grams) or "kcal" (calories)
    expect(infoText).toMatch(/g|kcal/);
  });

  test("tapping add button on a food item adds it to staging", async ({ page }) => {
    await navigateAndWait(page);

    await page.locator(SEL.nutritionCard).locator(SEL.filterButton).click();
    await expect(page.locator(SEL.foodFilterView)).toBeVisible();

    // Switch to All tab to guarantee items are shown
    const allTab = page
      .locator(SEL.filterTabs)
      .locator('button[role="tab"]')
      .filter({ hasText: "All" });
    await allTab.click();

    const foodRows = page.locator(SEL.foodFilterRow);
    await expect(foodRows.first()).toBeVisible({ timeout: 3000 });

    // Click the add button on the first food item
    const firstRow = foodRows.first();
    const addButton = firstRow.locator('button[aria-label^="Add "]');
    await expect(addButton).toBeVisible();
    await addButton.click();

    // Navigate back to collapsed view to check staging badge
    await page.locator(SEL.foodFilterView).locator(SEL.backButton).click();
    await expect(page.locator(SEL.collapsedView)).toBeVisible();

    // The "Log Food" button should show a staging count badge
    const logFoodButton = page.locator(SEL.logFoodButton);
    await expect(logFoodButton).toBeVisible();
    const stagingBadge = logFoodButton.locator("span.rounded-full");
    await expect(stagingBadge).toBeVisible();
    const badgeText = await stagingBadge.textContent();
    expect(Number(badgeText)).toBeGreaterThan(0);
  });

  test("switching between tabs changes the displayed tab panel", async ({ page }) => {
    await navigateAndWait(page);

    await page.locator(SEL.nutritionCard).locator(SEL.filterButton).click();
    await expect(page.locator(SEL.foodFilterView)).toBeVisible();

    const tablist = page.locator(SEL.filterTabs);

    // Click Frequent tab
    const frequentTab = tablist.locator('button[role="tab"]').filter({ hasText: "Frequent" });
    await frequentTab.click();
    await expect(frequentTab).toHaveAttribute("aria-selected", "true");

    // The tab panel should have the correct id for the frequent tab
    const frequentPanel = page.locator('#filter-panel-frequent[role="tabpanel"]');
    await expect(frequentPanel).toBeVisible();

    // Now switch to All tab
    const allTab = tablist.locator('button[role="tab"]').filter({ hasText: "All" });
    await allTab.click();
    await expect(allTab).toHaveAttribute("aria-selected", "true");

    // The panel should now be the All panel
    const allPanel = page.locator('#filter-panel-all[role="tabpanel"]');
    await expect(allPanel).toBeVisible();

    // The All tab should have food items (the registry is populated)
    const allFoodRows = allPanel.locator(SEL.foodFilterRow);
    await expect(allFoodRows.first()).toBeVisible({ timeout: 3000 });
  });

  test("back button returns to collapsed view from food filter", async ({ page }) => {
    await navigateAndWait(page);

    // Navigate to food filter
    await page.locator(SEL.nutritionCard).locator(SEL.filterButton).click();
    await expect(page.locator(SEL.foodFilterView)).toBeVisible();

    // Click the back button
    const backButton = page.locator(SEL.foodFilterView).locator(SEL.backButton);
    await expect(backButton).toBeVisible();
    await backButton.click();

    // Should return to collapsed view
    await expect(page.locator(SEL.collapsedView)).toBeVisible();
    await expect(page.locator(SEL.foodFilterView)).not.toBeVisible();
  });

  test("escape key returns to collapsed view from food filter", async ({ page }) => {
    await navigateAndWait(page);

    // Navigate to food filter
    await page.locator(SEL.nutritionCard).locator(SEL.filterButton).click();
    await expect(page.locator(SEL.foodFilterView)).toBeVisible();

    // Press Escape
    await page.keyboard.press("Escape");

    // Should return to collapsed view
    await expect(page.locator(SEL.collapsedView)).toBeVisible();
    await expect(page.locator(SEL.foodFilterView)).not.toBeVisible();
  });
});

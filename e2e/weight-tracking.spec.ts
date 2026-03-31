import { expect, test } from "./fixtures";

/**
 * E2E tests for weight tracking.
 *
 * Tests:
 * 1. Weight tile exists in Quick Capture
 * 2. Tapping Weight opens the weight entry drawer
 * 3. Can enter weight and save
 */
test.describe("Weight tracking", () => {
  // Helper to get the Quick Capture section
  const getQuickCapture = (page: import("@playwright/test").Page) =>
    page.locator('[data-slot="quick-capture"]');

  test("weight tile exists in Quick Capture", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible();

    const quickCapture = getQuickCapture(page);
    await expect(quickCapture).toBeVisible();

    // Find Weight tile (has Weight icon or "Weight" text)
    const weightTile = quickCapture.locator('button[aria-label^="Weigh-in quick capture"]');
    await expect(weightTile).toBeVisible();
  });

  test("tapping Weight opens weight entry drawer", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible();

    const quickCapture = getQuickCapture(page);
    const weightTile = quickCapture.locator('button[aria-label^="Weigh-in quick capture"]');

    // Tap the Weight tile
    await weightTile.click();
    await page.waitForTimeout(300);

    // Should see the weight entry drawer with input
    // The drawer has "Log Weight" title and a weight input
    const weightInput = page.locator('input[type="text"]').first();
    await expect(weightInput).toBeVisible();
  });

  test("can enter weight and save", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible();

    const quickCapture = getQuickCapture(page);
    const weightTile = quickCapture.locator('button[aria-label^="Weigh-in quick capture"]');

    // Tap the Weight tile
    await weightTile.click();
    await page.waitForTimeout(300);

    // Clear and enter a weight value
    const weightInput = page.locator('input[type="text"]').first();
    await weightInput.clear();
    await weightInput.fill("75.5");
    await page.waitForTimeout(200);

    // Submit via Enter (WeightEntryDrawer saves on Enter, no Save button)
    await weightInput.press("Enter");
    await page.waitForTimeout(500);

    // Popover should close — the weight-specific popover description should no longer be visible
    await expect(page.locator('text="Type weight, press Enter."')).not.toBeVisible({
      timeout: 5000,
    });
  });
});

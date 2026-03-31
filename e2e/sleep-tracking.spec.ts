import { expect, test } from "./fixtures";

/**
 * E2E tests for sleep tracking.
 *
 * Tests:
 * 1. Sleep tile exists in Quick Capture
 * 2. Tapping Sleep opens the sleep entry drawer
 * 3. Can select hours and minutes and log sleep
 */
test.describe("Sleep tracking", () => {
  // Helper to get the Quick Capture section
  const getQuickCapture = (page: import("@playwright/test").Page) =>
    page.locator('[data-slot="quick-capture"]');

  test("sleep tile exists in Quick Capture", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible();

    const quickCapture = getQuickCapture(page);
    await expect(quickCapture).toBeVisible();

    // Find Sleep tile
    const sleepTile = quickCapture.locator('[data-slot="quick-capture-tile"]', {
      has: page.locator('text="Sleep"'),
    });
    await expect(sleepTile).toBeVisible();
  });

  test("tapping Sleep opens sleep entry drawer", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible();

    const quickCapture = getQuickCapture(page);
    const sleepTile = quickCapture.locator('[data-slot="quick-capture-tile"]', {
      has: page.locator('text="Sleep"'),
    });

    // Tap the Sleep tile
    await sleepTile.click();
    await page.waitForTimeout(300);

    // Should see the sleep entry drawer/dialog with Hours and Minutes selectors
    const hoursLabel = page.locator("text=Hours").first();
    const minutesLabel = page.locator("text=Minutes").first();

    await expect(hoursLabel).toBeVisible();
    await expect(minutesLabel).toBeVisible();
  });

  test("can select hours and minutes and log sleep", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible();

    const quickCapture = getQuickCapture(page);
    const sleepTile = quickCapture.locator('[data-slot="quick-capture-tile"]', {
      has: page.locator('text="Sleep"'),
    });

    // Tap the Sleep tile
    await sleepTile.click();

    // Wait for the popover inputs to be visible before interacting
    const hoursInput = page.locator("#duration-popover-hours");
    const minsInput = page.locator("#duration-popover-mins");
    await expect(hoursInput).toBeVisible();
    await expect(minsInput).toBeVisible();

    // Fill in 7 hours using the text input
    await hoursInput.fill("7");

    // Fill in 30 minutes using the text input
    await minsInput.fill("30");

    // Submit via Enter (DurationEntryPopover saves on Enter, no Save button)
    await minsInput.press("Enter");

    // Popover should close — verify using the popover-specific hours input
    await expect(hoursInput).not.toBeVisible();
  });
});

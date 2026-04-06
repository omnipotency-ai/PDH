import { expect, test } from "./fixtures";
import { QuickCapturePage } from "./page-objects";

/**
 * E2E tests for weight tracking.
 *
 * Tests:
 * 1. Weight tile exists in Quick Capture
 * 2. Tapping Weight opens the weight entry drawer
 * 3. Can enter weight and save
 */
test.describe("Weight tracking", () => {
  test("weight tile exists in Quick Capture", async ({ page }) => {
    const quickCapture = new QuickCapturePage(page);
    await quickCapture.goto();

    await expect(quickCapture.weightTile).toBeVisible();
  });

  test("tapping Weight opens weight entry drawer", async ({ page }) => {
    const quickCapture = new QuickCapturePage(page);
    await quickCapture.goto();

    await quickCapture.openWeightDrawer();
    await expect(page.getByText("Type weight, press Enter.")).toBeVisible();
  });

  test("can enter weight and save", async ({ page }) => {
    const quickCapture = new QuickCapturePage(page);
    await quickCapture.goto();

    // Clear and enter a weight value
    const weightInput = await quickCapture.openWeightDrawer();
    await expect(weightInput).toBeVisible();
    await weightInput.clear();
    await weightInput.fill("75.5");

    // Submit via Enter (WeightEntryDrawer saves on Enter, no Save button)
    await weightInput.focus();
    await page.keyboard.press("Enter");

    // Popover should close — the weight-specific popover description should no longer be visible
    await expect(page.locator('text="Type weight, press Enter."')).not.toBeVisible({
      timeout: 5000,
    });
  });
});

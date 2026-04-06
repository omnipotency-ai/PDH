import { expect, test } from "./fixtures";
import { QuickCapturePage } from "./page-objects";

/**
 * E2E tests for sleep tracking.
 *
 * Tests:
 * 1. Sleep tile exists in Quick Capture
 * 2. Tapping Sleep opens the sleep entry drawer
 * 3. Can select hours and minutes and log sleep
 */
test.describe("Sleep tracking", () => {
  async function openSleepPopover(page: import("@playwright/test").Page) {
    const quickCapture = new QuickCapturePage(page);
    await quickCapture.goto();
    return await quickCapture.openSleepPopover();
  }

  async function logSleepDuration(
    page: import("@playwright/test").Page,
    hours: string,
    minutes: string,
  ) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { hoursInput, minsInput } = await openSleepPopover(page);

        await hoursInput.fill(hours, { timeout: 2500 });
        await minsInput.fill(minutes, { timeout: 2500 });
        await minsInput.press("Enter");
        await expect(hoursInput).not.toBeVisible({ timeout: 5000 });
        return;
      } catch (error) {
        if (attempt === 2) throw error;
        await page.keyboard.press("Escape").catch(() => {});
      }
    }
  }

  test("sleep tile exists in Quick Capture", async ({ page }) => {
    const quickCapture = new QuickCapturePage(page);
    await quickCapture.goto();

    // Find Sleep tile
    await expect(quickCapture.sleepTile).toBeVisible();
  });

  test("tapping Sleep opens sleep entry drawer", async ({ page }) => {
    const quickCapture = new QuickCapturePage(page);
    await quickCapture.goto();

    await quickCapture.openSleepPopover();
  });

  test("can select hours and minutes and log sleep", async ({ page }) => {
    await logSleepDuration(page, "7", "30");
  });
});

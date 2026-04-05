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

  const getSleepTileButton = (page: import("@playwright/test").Page) =>
    getQuickCapture(page).getByRole("button", { name: /^Sleep:/ }).first();

  async function openSleepPopover(page: import("@playwright/test").Page) {
    const hoursInput = page.locator("#duration-popover-hours");
    const minsInput = page.locator("#duration-popover-mins");

    for (let attempt = 0; attempt < 3; attempt++) {
      await getSleepTileButton(page).click();
      try {
        await expect(hoursInput).toBeVisible({ timeout: 2500 });
        await expect(minsInput).toBeVisible({ timeout: 2500 });
        return;
      } catch (error) {
        if (attempt === 2) throw error;
        await page.keyboard.press("Escape").catch(() => {});
      }
    }
  }

  async function logSleepDuration(
    page: import("@playwright/test").Page,
    hours: string,
    minutes: string,
  ) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await openSleepPopover(page);

        const hoursInput = page.locator("#duration-popover-hours");
        const minsInput = page.locator("#duration-popover-mins");

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
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible();

    const quickCapture = getQuickCapture(page);
    await expect(quickCapture).toBeVisible();

    // Find Sleep tile
    await expect(getSleepTileButton(page)).toBeVisible();
  });

  test("tapping Sleep opens sleep entry drawer", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible();

    await openSleepPopover(page);
  });

  test("can select hours and minutes and log sleep", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible();

    await logSleepDuration(page, "7", "30");
  });
});

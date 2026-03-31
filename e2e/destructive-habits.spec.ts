import { expect, test } from "./fixtures";

/**
 * E2E tests for destructive habit tracking (habits with caps like cigarettes).
 *
 * These habits have a cap (maximum recommended) and track "X left" or "At cap" status.
 *
 * Setup: Each test ensures the target habit is visible in Quick Capture by adding
 * it via the Add Habit drawer if it's not already present. Cigarettes and Rec Drugs
 * are not in DEFAULT_HABIT_TEMPLATE_KEYS so fresh test users won't have them.
 */
test.describe("Destructive habit tracking", () => {
  // Helper to get the Quick Capture section
  const getQuickCapture = (page: import("@playwright/test").Page) =>
    page.locator('[data-slot="quick-capture"]');

  /**
   * Gets the main action button for a habit tile (not the Hide or details buttons).
   * The main button has aria-label="${habitName}: ..." with status text.
   */
  const getMainTileButton = (
    tile: import("@playwright/test").Locator,
    habitName: string,
  ) =>
    tile.getByRole("button", {
      name: new RegExp(`^${habitName}:`),
    });

  /**
   * Ensures a destructive habit is visible in Quick Capture.
   * If the tile already exists (from a prior test run), skips the Add Habit flow.
   * If not, adds it via the Add Habit drawer using the template.
   */
  async function ensureDestructiveHabit(
    page: import("@playwright/test").Page,
    habitName: string,
  ) {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible();

    const quickCapture = getQuickCapture(page);
    await expect(quickCapture).toBeVisible();

    // Wait for Convex data to load (at least one habit tile must appear)
    await quickCapture
      .locator('[data-slot="quick-capture-tile"]')
      .first()
      .waitFor({ timeout: 5000 });

    const existingTile = quickCapture.locator(
      '[data-slot="quick-capture-tile"]',
      {
        has: page.locator(`text="${habitName}"`),
      },
    );

    // Destructive habits may load slightly after defaults — give them a moment
    try {
      await existingTile.waitFor({ state: "visible", timeout: 2000 });
      return;
    } catch {
      // Not found within 2s, need to add it via the template drawer
    }

    // Open Add Habit drawer
    await quickCapture.getByRole("button", { name: "Add habit" }).click();

    // Select "Destructive (cap)" type
    await expect(page.getByText("Destructive (cap)")).toBeVisible();
    await page.getByText("Destructive (cap)").click();

    // Find the action button for this habit template
    const habitNameLabel = page.locator(`p:text-is("${habitName}")`).first();
    await expect(habitNameLabel).toBeVisible();
    const actionButton = habitNameLabel.locator(
      "xpath=following-sibling::div[1]/button[1]",
    );
    const buttonText = await actionButton.textContent();

    if (buttonText?.trim() === "Already displayed") {
      // Habit is configured and shown — close the drawer and wait for tile
      await page.keyboard.press("Escape");
      await existingTile.waitFor({ state: "visible", timeout: 5000 });
      return;
    }

    // Click "Add template" or "Show again"
    await actionButton.click();

    // Wait for the drawer to close and tile to appear
    await page.waitForTimeout(500);
    await expect(existingTile).toBeVisible();
  }

  test("tapping cigarettes increments count and updates status", async ({
    page,
  }) => {
    await ensureDestructiveHabit(page, "Cigarettes");

    const quickCapture = getQuickCapture(page);
    const cigarettesTile = quickCapture.locator(
      '[data-slot="quick-capture-tile"]',
      {
        has: page.locator('text="Cigarettes"'),
      },
    );

    const tileButton = getMainTileButton(cigarettesTile, "Cigarettes");
    await expect(tileButton).toBeVisible();

    // Extract the current count from the aria-label
    const labelBefore = await tileButton.getAttribute("aria-label");
    const countBefore = Number(
      labelBefore?.match(/(\d+)\s+(left|over)/)?.[1] ?? "0",
    );

    // Tap the tile to increment by 1
    await tileButton.click();

    // Wait for the label to update (Convex round-trip) using Playwright auto-retry
    await expect(tileButton).not.toHaveAttribute(
      "aria-label",
      labelBefore ?? "",
    );

    // Verify the label still has a valid cap status format
    const labelAfter = await tileButton.getAttribute("aria-label");
    expect(labelAfter).toMatch(/^Cigarettes: /);
    expect(labelAfter).toMatch(/\d+ left|At cap|\d+ over/);

    // The numeric count should have changed
    const countAfter = Number(
      labelAfter?.match(/(\d+)\s+(left|over)/)?.[1] ?? "0",
    );
    expect(countAfter).not.toBe(countBefore);
  });

  test("rec drugs tile shows cap status if present", async ({ page }) => {
    await ensureDestructiveHabit(page, "Rec Drugs");

    const quickCapture = getQuickCapture(page);
    const recDrugsTile = quickCapture.locator(
      '[data-slot="quick-capture-tile"]',
      {
        has: page.locator('text="Rec Drugs"'),
      },
    );
    await expect(recDrugsTile).toBeVisible();

    // The main tile button aria-label should reflect a cap-based status
    const tileButton = getMainTileButton(recDrugsTile, "Rec Drugs");
    await expect(tileButton).toHaveAttribute(
      "aria-label",
      /Rec Drugs: (\d+ left|At cap|\d+ over)/,
    );
  });

  test("cigarettes cap prevents going too far over", async ({ page }) => {
    await ensureDestructiveHabit(page, "Cigarettes");

    const quickCapture = getQuickCapture(page);
    const cigarettesTile = quickCapture.locator(
      '[data-slot="quick-capture-tile"]',
      {
        has: page.locator('text="Cigarettes"'),
      },
    );

    const tileButton = getMainTileButton(cigarettesTile, "Cigarettes");

    // Tap enough times to exceed the cap (dailyCap=10).
    // Even if the count isn't at zero, 11 additional taps will push past the cap.
    for (let i = 0; i < 11; i++) {
      await tileButton.click();
      await page.waitForTimeout(200);
    }

    // After exceeding the cap, the status should show "X over"
    await expect(tileButton).toHaveAttribute(
      "aria-label",
      /Cigarettes: \d+ over/,
    );
  });

  test("long press on cigarettes tile opens habit detail sheet", async ({
    page,
  }) => {
    await ensureDestructiveHabit(page, "Cigarettes");

    const quickCapture = getQuickCapture(page);
    const cigarettesTile = quickCapture.locator(
      '[data-slot="quick-capture-tile"]',
      {
        has: page.locator('text="Cigarettes"'),
      },
    );

    // On desktop (1280px viewport), the 3-dot menu button is visible for detail sheet access.
    // This is more reliable than simulating a long press in Playwright.
    const detailsButton = cigarettesTile.getByRole("button", {
      name: "Cigarettes details",
    });
    await expect(detailsButton).toBeVisible();
    await detailsButton.click();
    await page.waitForTimeout(300);

    // The HabitDetailSheet should open with habit-specific content
    // Scope assertions to the sheet to avoid matching nav "Settings" link
    const sheet = page.locator('[role="dialog"], [data-vaul-drawer]').last();
    await expect(sheet.getByText("Daily cap")).toBeVisible();
    await expect(sheet.getByText("Last 7 days", { exact: true })).toBeVisible();
  });
});

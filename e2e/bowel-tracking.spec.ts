import { expect, test } from "./fixtures";

/**
 * E2E tests for bowel movement tracking.
 *
 * Tests:
 * 1. Bowel section is visible with Bristol scale selector
 * 2. Can select Bristol type and save
 * 3. Bowel entry appears in Today's Log
 */
test.describe("Bowel movement tracking", () => {
  // Helper to get the BowelSection
  const getBowelSection = (page: import("@playwright/test").Page) =>
    page.locator("section.glass-card-bowel");

  test("bowel section is visible with Bristol scale options", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible();

    const bowelSection = getBowelSection(page);
    await expect(bowelSection).toBeVisible();

    // Should show Bristol scale types (1-7 illustrations)
    // Bristol type 4 is typically selected by default (ideal stool)
    const bristolOption = bowelSection.locator('[aria-label*="Type"]').first();
    await expect(bristolOption).toBeVisible();
  });

  test("can select Bristol type and log bowel movement", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible();

    const bowelSection = getBowelSection(page);
    await expect(bowelSection).toBeVisible();

    // Select Bristol Type 4 (should be in the Bristol illustrations)
    const bristolType4 = bowelSection.locator('[aria-label*="Type 4"]');
    if (await bristolType4.isVisible()) {
      await bristolType4.click();
    }

    // Find and click the save/log button
    const saveButton = bowelSection.locator("button", { hasText: /Log|Save/i });
    await expect(saveButton).toBeVisible();
    await saveButton.click();

    // Check Today's Log for the Digestion group
    const digestionGroupButton = page.locator("button", { hasText: /^Digestion|^Bowel/i }).first();
    await expect(digestionGroupButton).toBeVisible();
  });

  test("urgency and effort scales are available", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible();

    const bowelSection = getBowelSection(page);
    await expect(bowelSection).toBeVisible();

    // Urgency/effort scales are only revealed after selecting a Bristol type.
    // Select Bristol Type 4 to expand the detail fields.
    const bristolType4 = bowelSection.locator('input[aria-label*="Bristol type 4"]');
    await bristolType4.click({ force: true });

    // Check for urgency scale (Low, Med, High, Now!)
    const urgencyLow = bowelSection.locator('[aria-label="Urgency: Low"]');
    await expect(urgencyLow).toBeVisible();

    // Check for effort scale (Easy, Some, Hard, Boom)
    const effortEasy = bowelSection.locator('[aria-label="Effort: Easy"]');
    await expect(effortEasy).toBeVisible();
  });
});

import { expect, test } from "./fixtures";

/**
 * E2E tests for fluid tracking.
 *
 * Tests:
 * 1. Fluid section is visible with ml input
 * 2. Can log water
 * 3. Can log custom fluid via "Other"
 * 4. Fluid total updates in Today's Log
 */
test.describe("Fluid tracking", () => {
  // Helper to get the FluidSection (input form)
  const getFluidSection = (page: import("@playwright/test").Page) =>
    page.locator("section.glass-card-fluid");

  // Helper to get the Fluids group button in Today's Log
  const getFluidsGroupButton = (page: import("@playwright/test").Page) =>
    page.locator("button", { hasText: /^Fluids/ }).first();

  test("fluid section is visible with ml input and preset buttons", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible();

    const fluidSection = getFluidSection(page);
    await expect(fluidSection).toBeVisible();

    // Should have ml input
    const mlInput = fluidSection.locator("input[placeholder='mls']");
    await expect(mlInput).toBeVisible();

    // Should have Water button
    const waterButton = fluidSection.locator('button[aria-label="Log water"]');
    await expect(waterButton).toBeVisible();

    // Should have Other button
    const otherButton = fluidSection.locator('button[aria-label="Log a custom drink"]');
    await expect(otherButton).toBeVisible();
  });

  test("can log water", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible();

    const fluidSection = getFluidSection(page);
    const mlInput = fluidSection.locator("input[placeholder='mls']");

    // Enter ml amount
    await mlInput.fill("300");

    // Click Water button
    const waterButton = fluidSection.locator('button[aria-label="Log water"]');
    await waterButton.click();
    await page.waitForTimeout(500);

    // Input should be cleared
    await expect(mlInput).toHaveValue("");

    // Fluids group should show in Today's Log
    const fluidsGroupButton = getFluidsGroupButton(page);
    await expect(fluidsGroupButton).toBeVisible();
  });

  test("can log custom fluid via Other", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible();

    const fluidSection = getFluidSection(page);
    const mlInput = fluidSection.locator("input[placeholder='mls']");

    // Enter ml amount
    await mlInput.fill("200");

    // Click Other button
    const otherButton = fluidSection.locator('button[aria-label="Log a custom drink"]');
    await otherButton.click();
    await page.waitForTimeout(200);

    // Enter custom fluid name
    const nameInput = fluidSection.locator('input[placeholder="Drink name"]');
    await expect(nameInput).toBeVisible();
    await nameInput.fill("Juice");

    // Click Log button
    const logButton = fluidSection.locator('button[aria-label="Log other drink"]');
    await logButton.click();
    await page.waitForTimeout(500);

    // Expand Fluids group to verify entry
    const fluidsGroupButton = getFluidsGroupButton(page);
    await fluidsGroupButton.click();
    await page.waitForTimeout(300);

    // Should see Juice in the list
    const juiceEntry = page.locator("text=Juice").first();
    await expect(juiceEntry).toBeVisible();
  });

  test("fluid total updates after multiple entries", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible();

    const fluidSection = getFluidSection(page);
    const mlInput = fluidSection.locator("input[placeholder='mls']");
    const waterButton = fluidSection.locator('button[aria-label="Log water"]');

    // Log first water entry (200ml).
    // This also ensures the Fluids group is present in Today's Log.
    await mlInput.fill("200");
    await waterButton.click();
    await page.waitForTimeout(500);

    // Capture the total after the first entry
    const fluidsGroupButton = getFluidsGroupButton(page);
    await expect(fluidsGroupButton).toBeVisible();
    const badgeAfterFirst = fluidsGroupButton.locator("span.font-mono").first();
    const textAfterFirst = await badgeAfterFirst.textContent();
    const totalAfterFirst = Number.parseFloat(textAfterFirst ?? "0");

    // Log second water entry (300ml)
    await mlInput.fill("300");
    await waterButton.click();
    await page.waitForTimeout(500);

    // The total should have increased by 0.3L (300ml)
    const badgeAfterSecond = getFluidsGroupButton(page).locator("span.font-mono").first();
    const textAfterSecond = await badgeAfterSecond.textContent();
    const totalAfterSecond = Number.parseFloat(textAfterSecond ?? "0");
    const addedL = totalAfterSecond - totalAfterFirst;
    // We added 300ml = 0.3L between the two captures
    expect(addedL).toBeCloseTo(0.3, 1);
  });
});

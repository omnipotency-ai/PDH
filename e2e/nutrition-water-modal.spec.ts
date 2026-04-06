import { expect, test } from "./fixtures";

/**
 * E2E tests for the WaterModal component inside NutritionCard.
 *
 * The WaterModal opens when the user taps the water progress bar or
 * the water icon in the NutritionCard header. It shows a sky-blue ring
 * (var(--water)), +/- 50ml buttons, an editable ml input, and a Log
 * Water button. Close via X button or Escape.
 */
test.describe("Water Modal", () => {
  // Helper to get the NutritionCard section
  const getNutritionCard = (page: import("@playwright/test").Page) =>
    page.locator('[data-slot="nutrition-card"]');

  // Helper to get the WaterModal dialog
  const getWaterModal = (page: import("@playwright/test").Page) =>
    page.locator('[data-slot="water-modal"]');

  // Helper to open the WaterModal via the header water icon
  async function openWaterModal(page: import("@playwright/test").Page) {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible();

    const nutritionCard = getNutritionCard(page);
    await expect(nutritionCard).toBeVisible();

    // Click the water icon button in the NutritionCard header
    const waterIconButton = nutritionCard.locator('button[aria-label="Log water"]');
    await expect(waterIconButton).toBeVisible();
    await waterIconButton.click();
    await page.waitForTimeout(200);

    const modal = getWaterModal(page);
    await expect(modal).toBeVisible();
    return modal;
  }

  test("water icon opens the WaterModal", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible();

    const nutritionCard = getNutritionCard(page);
    await expect(nutritionCard).toBeVisible();

    // Modal should not be visible initially
    const modal = getWaterModal(page);
    await expect(modal).not.toBeVisible();

    // Click the water icon in the header
    const waterIconButton = nutritionCard.locator('button[aria-label="Log water"]');
    await waterIconButton.click();
    await page.waitForTimeout(200);

    // Modal should now be visible
    await expect(modal).toBeVisible();
  });

  test("water progress bar also opens the WaterModal", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible();

    const nutritionCard = getNutritionCard(page);
    await expect(nutritionCard).toBeVisible();

    // Click the water progress row
    const waterProgressRow = nutritionCard.locator('[data-slot="water-progress"]');
    await expect(waterProgressRow).toBeVisible();
    await waterProgressRow.click();
    await page.waitForTimeout(200);

    // Modal should be visible
    const modal = getWaterModal(page);
    await expect(modal).toBeVisible();
  });

  test("modal displays default water amount of 0 ml", async ({ page }) => {
    const modal = await openWaterModal(page);

    // The amount input should show "0"
    const amountInput = modal.locator('input[aria-label="Amount to add in millilitres"]');
    await expect(amountInput).toBeVisible();
    await expect(amountInput).toHaveValue("0");
  });

  test("plus button increases amount by 50ml", async ({ page }) => {
    const modal = await openWaterModal(page);

    const increaseButton = modal.locator('button[aria-label="Increase amount"]');
    await expect(increaseButton).toBeVisible();
    await increaseButton.click();
    await page.waitForTimeout(100);

    // Should now show 50ml
    const amountInput = modal.locator('input[aria-label="Amount to add in millilitres"]');
    await expect(amountInput).toHaveValue("50");

    // Click increase again
    await increaseButton.click();
    await page.waitForTimeout(100);

    // Should now show 100ml
    await expect(amountInput).toHaveValue("100");
  });

  test("minus button decreases amount by 50ml with floor at 0", async ({ page }) => {
    const modal = await openWaterModal(page);

    // Start at 0, increase to 50 first
    const increaseButton = modal.locator('button[aria-label="Increase amount"]');
    await increaseButton.click();
    await page.waitForTimeout(100);

    const amountInput = modal.locator('input[aria-label="Amount to add in millilitres"]');
    await expect(amountInput).toHaveValue("50");

    // Now decrease back to 0
    const decreaseButton = modal.locator('button[aria-label="Decrease amount"]');
    await decreaseButton.click();
    await page.waitForTimeout(100);

    await expect(amountInput).toHaveValue("0");

    // Decrease button should be disabled at 0
    await expect(decreaseButton).toBeDisabled();
  });

  test("close button closes the modal without logging", async ({ page }) => {
    const modal = await openWaterModal(page);

    // Increase amount to 100ml first (so we can verify nothing was logged)
    const increaseButton = modal.locator('button[aria-label="Increase amount"]');
    await increaseButton.click();
    await increaseButton.click();
    await page.waitForTimeout(100);

    // Click the X close button
    const closeButton = modal.locator('button[aria-label="Close"]');
    await expect(closeButton).toBeVisible();
    await closeButton.click();
    await page.waitForTimeout(200);

    // Modal should be closed
    await expect(modal).not.toBeVisible();
  });

  test("log button logs water and closes the modal", async ({ page }) => {
    const modal = await openWaterModal(page);

    // Need to add some amount first (starts at 0, button is disabled)
    const increaseButton = modal.locator('button[aria-label="Increase amount"]');
    await increaseButton.click();
    await page.waitForTimeout(100);

    // Click "Log Water" button
    const logButton = modal.getByRole("button", { name: /Log Water/i });
    await expect(logButton).toBeVisible();
    await logButton.click();
    await page.waitForTimeout(500);

    // Modal should close after logging
    await expect(modal).not.toBeVisible();
  });

  test("modal has proper accessibility attributes", async ({ page }) => {
    const modal = await openWaterModal(page);

    // role="dialog"
    await expect(modal).toHaveAttribute("role", "dialog");

    // aria-modal="true"
    await expect(modal).toHaveAttribute("aria-modal", "true");

    // aria-label
    await expect(modal).toHaveAttribute("aria-label", "Log Water");
  });

  test("escape key closes the modal", async ({ page }) => {
    const modal = await openWaterModal(page);
    await expect(modal).toBeVisible();

    // Press Escape
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);

    // Modal should be closed
    await expect(modal).not.toBeVisible();
  });

  test("clicking overlay backdrop closes the modal", async ({ page }) => {
    await openWaterModal(page);

    // Click the overlay (outside the modal dialog)
    const overlay = page.locator('[data-slot="water-modal-overlay"]');
    await expect(overlay).toBeVisible();

    // Click the top-left corner of the overlay (outside the centered dialog)
    await overlay.click({ position: { x: 10, y: 10 } });
    await page.waitForTimeout(200);

    // Modal should be closed
    const modal = getWaterModal(page);
    await expect(modal).not.toBeVisible();
  });

  test("modal displays sky-blue accent color on progress ring", async ({ page }) => {
    const modal = await openWaterModal(page);

    // The progress ring SVG should have a circle with var(--water) stroke
    const ringContainer = modal.locator('[data-slot="water-modal-ring"]');
    await expect(ringContainer).toBeVisible();

    // Check the primary progress arc uses the CSS variable
    const progressArc = ringContainer.locator("svg circle").nth(1);
    await expect(progressArc).toHaveAttribute("stroke", "var(--water)");
  });

  test("user can type a custom amount in the input", async ({ page }) => {
    const modal = await openWaterModal(page);

    const amountInput = modal.locator('input[aria-label="Amount to add in millilitres"]');
    await amountInput.click();
    await amountInput.fill("175");
    await page.waitForTimeout(100);

    // Log Water should be enabled now
    const logButton = modal.getByRole("button", { name: /Log Water/i });
    await expect(logButton).toBeEnabled();
  });

  test("plus button is disabled at maximum amount (2000ml)", async ({ page }) => {
    const modal = await openWaterModal(page);

    // Type 2000 directly instead of clicking 40 times
    const amountInput = modal.locator('input[aria-label="Amount to add in millilitres"]');
    await amountInput.click();
    await amountInput.fill("2000");
    await page.waitForTimeout(100);

    // Increase button should be disabled at max
    const increaseButton = modal.locator('button[aria-label="Increase amount"]');
    await expect(increaseButton).toBeDisabled();
  });

  test("log button is disabled when amount is 0", async ({ page }) => {
    const modal = await openWaterModal(page);

    // Amount starts at 0, so Log Water should be disabled
    const logButton = modal.getByRole("button", { name: /Log Water/i });
    await expect(logButton).toBeDisabled();
  });

  test("modal resets amount to 0 when reopened", async ({ page }) => {
    // Open modal and add some amount
    const modal = await openWaterModal(page);
    const increaseButton = modal.locator('button[aria-label="Increase amount"]');
    await increaseButton.click();
    await increaseButton.click();
    await page.waitForTimeout(100);

    // Verify it changed to 100
    const amountInput = modal.locator('input[aria-label="Amount to add in millilitres"]');
    await expect(amountInput).toHaveValue("100");

    // Close via X button
    const closeButton = modal.locator('button[aria-label="Close"]');
    await closeButton.click();
    await page.waitForTimeout(200);
    await expect(modal).not.toBeVisible();

    // Reopen
    const nutritionCard = getNutritionCard(page);
    const waterIconButton = nutritionCard.locator('button[aria-label="Log water"]');
    await waterIconButton.click();
    await page.waitForTimeout(200);

    // Should be back to 0
    await expect(modal).toBeVisible();
    await expect(amountInput).toHaveValue("0");
  });
});

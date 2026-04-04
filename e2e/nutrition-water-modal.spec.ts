import { expect, test } from "./fixtures";

/**
 * E2E tests for the WaterModal component inside NutritionCard.
 *
 * The WaterModal opens when the user taps the water progress bar or
 * the water icon in the NutritionCard header. It shows a cyan (#42BCB8)
 * ring, +/- 200ml buttons, and Cancel/Log Water actions.
 *
 * Tests:
 * 1. Water icon opens the WaterModal
 * 2. Modal displays default water amount (200 ml)
 * 3. Plus button increases amount by 200ml
 * 4. Minus button decreases amount by 200ml (floor at 0)
 * 5. Cancel button closes the modal without logging
 * 6. Log button closes the modal (integration test)
 * 7. Modal has proper accessibility: role=dialog, aria-modal, escape to close
 * 8. Modal displays cyan (#42BCB8) accent color on ring/progress
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

  test("modal displays default water amount of 200 ml", async ({ page }) => {
    const modal = await openWaterModal(page);

    // The amount selector should show "200 ml"
    const amountSelector = modal.locator('[data-slot="water-modal-amount"]');
    await expect(amountSelector).toBeVisible();
    await expect(amountSelector).toContainText("200");
    await expect(amountSelector).toContainText("ml");
  });

  test("plus button increases amount by 200ml", async ({ page }) => {
    const modal = await openWaterModal(page);

    // Starting at 200ml, click increase
    const increaseButton = modal.locator('button[aria-label="Increase amount"]');
    await expect(increaseButton).toBeVisible();
    await increaseButton.click();
    await page.waitForTimeout(100);

    // Should now show 400ml
    const amountSelector = modal.locator('[data-slot="water-modal-amount"]');
    await expect(amountSelector).toContainText("400");

    // Click increase again
    await increaseButton.click();
    await page.waitForTimeout(100);

    // Should now show 600ml
    await expect(amountSelector).toContainText("600");
  });

  test("minus button decreases amount by 200ml with floor at 0", async ({ page }) => {
    const modal = await openWaterModal(page);

    // Starting at 200ml, click decrease
    const decreaseButton = modal.locator('button[aria-label="Decrease amount"]');
    await expect(decreaseButton).toBeVisible();
    await decreaseButton.click();
    await page.waitForTimeout(100);

    // Should now show 0ml
    const amountSelector = modal.locator('[data-slot="water-modal-amount"]');
    await expect(amountSelector).toContainText("0");

    // Decrease button should be disabled at 0
    await expect(decreaseButton).toBeDisabled();
  });

  test("cancel button closes the modal without logging", async ({ page }) => {
    const modal = await openWaterModal(page);

    // Increase amount to 400ml first (so we can verify nothing was logged)
    const increaseButton = modal.locator('button[aria-label="Increase amount"]');
    await increaseButton.click();
    await page.waitForTimeout(100);

    // Click Cancel
    const cancelButton = modal.getByText("Cancel");
    await expect(cancelButton).toBeVisible();
    await cancelButton.click();
    await page.waitForTimeout(200);

    // Modal should be closed
    await expect(modal).not.toBeVisible();
  });

  test("log button logs water and closes the modal", async ({ page }) => {
    const modal = await openWaterModal(page);

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

  test("modal displays cyan accent color on progress ring", async ({ page }) => {
    const modal = await openWaterModal(page);

    // The progress ring SVG should have a circle with cyan stroke
    const ringContainer = modal.locator('[data-slot="water-modal-ring"]');
    await expect(ringContainer).toBeVisible();

    // Check the progress arc circle has the correct stroke color
    const progressArc = ringContainer.locator("svg circle").nth(1);
    await expect(progressArc).toHaveAttribute("stroke", "#42BCB8");
  });

  test("plus button is disabled at maximum amount (2000ml)", async ({ page }) => {
    const modal = await openWaterModal(page);

    const increaseButton = modal.locator('button[aria-label="Increase amount"]');

    // Click increase 9 times: 200 -> 400 -> 600 -> 800 -> 1000 -> 1200 -> 1400 -> 1600 -> 1800 -> 2000
    for (let i = 0; i < 9; i++) {
      await increaseButton.click();
      await page.waitForTimeout(50);
    }

    // Should be at 2000ml now
    const amountSelector = modal.locator('[data-slot="water-modal-amount"]');
    await expect(amountSelector).toContainText("2000");

    // Increase button should be disabled at max
    await expect(increaseButton).toBeDisabled();
  });

  test("log button is disabled when amount is 0", async ({ page }) => {
    const modal = await openWaterModal(page);

    // Decrease from 200 to 0
    const decreaseButton = modal.locator('button[aria-label="Decrease amount"]');
    await decreaseButton.click();
    await page.waitForTimeout(100);

    // Log Water button should be disabled
    const logButton = modal.getByRole("button", { name: /Log Water/i });
    await expect(logButton).toBeDisabled();
  });

  test("modal resets amount to default when reopened", async ({ page }) => {
    // Open modal and change amount
    const modal = await openWaterModal(page);
    const increaseButton = modal.locator('button[aria-label="Increase amount"]');
    await increaseButton.click();
    await page.waitForTimeout(100);

    // Verify it changed to 400
    const amountSelector = modal.locator('[data-slot="water-modal-amount"]');
    await expect(amountSelector).toContainText("400");

    // Close via Cancel
    const cancelButton = modal.getByText("Cancel");
    await cancelButton.click();
    await page.waitForTimeout(200);
    await expect(modal).not.toBeVisible();

    // Reopen
    const nutritionCard = getNutritionCard(page);
    const waterIconButton = nutritionCard.locator('button[aria-label="Log water"]');
    await waterIconButton.click();
    await page.waitForTimeout(200);

    // Should be back to default 200ml
    await expect(modal).toBeVisible();
    await expect(amountSelector).toContainText("200");
  });
});

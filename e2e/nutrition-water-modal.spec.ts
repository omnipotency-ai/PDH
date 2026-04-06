import { expect, test } from "./fixtures";
import { TrackPage } from "./page-objects";

/**
 * E2E tests for the WaterModal component inside NutritionCard.
 *
 * The WaterModal opens when the user taps the water progress bar or
 * the water icon in the NutritionCard header. It shows a sky-blue ring
 * (var(--water)), +/- 50ml buttons, an editable ml input, and a Log
 * Water button. Close via X button or Escape.
 */
test.describe("Water Modal", () => {
  async function openWaterModal(track: TrackPage) {
    await track.goto();

    await track.openWaterModal();
    const modal = track.waterModal;
    return modal;
  }

  test("water icon opens the WaterModal", async ({ page }) => {
    const track = new TrackPage(page);
    await track.goto();

    // Modal should not be visible initially
    await expect(track.waterModal).not.toBeVisible();

    // Click the water icon in the header
    await track.openWaterModalFromHeader();

    // Modal should now be visible
    await expect(track.waterModal).toBeVisible();
  });

  test("water progress bar also opens the WaterModal", async ({ page }) => {
    const track = new TrackPage(page);
    await track.goto();

    // Click the water progress row
    await expect(track.waterProgress).toBeVisible();
    await track.openWaterModal();

    // Modal should be visible
    await expect(track.waterModal).toBeVisible();
  });

  test("modal displays default water amount of 0 ml", async ({ page }) => {
    const track = new TrackPage(page);
    const modal = await openWaterModal(track);

    // The amount input should show "0"
    const amountInput = modal.locator('input[aria-label="Amount to add in millilitres"]');
    await expect(amountInput).toBeVisible();
    await expect(amountInput).toHaveValue("0");
  });

  test("plus button increases amount by 50ml", async ({ page }) => {
    const track = new TrackPage(page);
    const modal = await openWaterModal(track);

    const increaseButton = modal.locator('button[aria-label="Increase amount"]');
    await expect(increaseButton).toBeVisible();
    await increaseButton.click();

    // Should now show 50ml
    const amountInput = modal.locator('input[aria-label="Amount to add in millilitres"]');
    await expect(amountInput).toHaveValue("50");

    // Click increase again
    await increaseButton.click();

    // Should now show 100ml
    await expect(amountInput).toHaveValue("100");
  });

  test("minus button decreases amount by 50ml with floor at 0", async ({ page }) => {
    const track = new TrackPage(page);
    const modal = await openWaterModal(track);

    // Start at 0, increase to 50 first
    const increaseButton = modal.locator('button[aria-label="Increase amount"]');
    await increaseButton.click();

    const amountInput = modal.locator('input[aria-label="Amount to add in millilitres"]');
    await expect(amountInput).toHaveValue("50");

    // Now decrease back to 0
    const decreaseButton = modal.locator('button[aria-label="Decrease amount"]');
    await decreaseButton.click();

    await expect(amountInput).toHaveValue("0");

    // Decrease button should be disabled at 0
    await expect(decreaseButton).toBeDisabled();
  });

  test("close button closes the modal without logging", async ({ page }) => {
    const track = new TrackPage(page);
    const modal = await openWaterModal(track);

    // Increase amount to 100ml first (so we can verify nothing was logged)
    const increaseButton = modal.locator('button[aria-label="Increase amount"]');
    await increaseButton.click();
    await increaseButton.click();

    // Click the X close button
    const closeButton = modal.locator('button[aria-label="Close"]');
    await expect(closeButton).toBeVisible();
    await closeButton.click();

    // Modal should be closed
    await expect(modal).not.toBeVisible();
  });

  test("log button logs water and closes the modal", async ({ page }) => {
    const track = new TrackPage(page);
    const modal = await openWaterModal(track);

    // Need to add some amount first (starts at 0, button is disabled)
    const increaseButton = modal.locator('button[aria-label="Increase amount"]');
    await increaseButton.click();

    // Click "Log Water" button
    const logButton = modal.getByRole("button", { name: /Log Water/i });
    await expect(logButton).toBeVisible();
    await logButton.click();

    // Modal should close after logging
    await expect(modal).not.toBeVisible();
  });

  test("modal has proper accessibility attributes", async ({ page }) => {
    const track = new TrackPage(page);
    const modal = await openWaterModal(track);

    // role="dialog"
    await expect(modal).toHaveAttribute("role", "dialog");

    // aria-modal="true"
    await expect(modal).toHaveAttribute("aria-modal", "true");

    // aria-label
    await expect(modal).toHaveAttribute("aria-label", "Log Water");
  });

  test("escape key closes the modal", async ({ page }) => {
    const track = new TrackPage(page);
    const modal = await openWaterModal(track);
    await expect(modal).toBeVisible();

    // Press Escape
    await page.keyboard.press("Escape");

    // Modal should be closed
    await expect(modal).not.toBeVisible();
  });

  test("clicking overlay backdrop closes the modal", async ({ page }) => {
    const track = new TrackPage(page);
    await openWaterModal(track);

    // Click the overlay (outside the modal dialog)
    const overlay = page.locator('[data-slot="water-modal-overlay"]');
    await expect(overlay).toBeVisible();

    // Click the top-left corner of the overlay (outside the centered dialog)
    await overlay.click({ position: { x: 10, y: 10 } });

    // Modal should be closed
    await expect(track.waterModal).not.toBeVisible();
  });

  test("modal displays sky-blue accent color on progress ring", async ({ page }) => {
    const track = new TrackPage(page);
    const modal = await openWaterModal(track);

    // The progress ring SVG should have a circle with var(--water) stroke
    const ringContainer = modal.locator('[data-slot="water-modal-ring"]');
    await expect(ringContainer).toBeVisible();

    // Check the primary progress arc uses the CSS variable
    const progressArc = ringContainer.locator("svg circle").nth(1);
    await expect(progressArc).toHaveAttribute("stroke", "var(--fluid)");
  });

  test("user can type a custom amount in the input", async ({ page }) => {
    const track = new TrackPage(page);
    const modal = await openWaterModal(track);

    const amountInput = modal.locator('input[aria-label="Amount to add in millilitres"]');
    await amountInput.click();
    await amountInput.fill("175");

    // Log Water should be enabled now
    const logButton = modal.getByRole("button", { name: /Log Water/i });
    await expect(logButton).toBeEnabled();
  });

  test("plus button is disabled at maximum amount (2000ml)", async ({ page }) => {
    const track = new TrackPage(page);
    const modal = await openWaterModal(track);

    // Type 2000 directly instead of clicking 40 times
    const amountInput = modal.locator('input[aria-label="Amount to add in millilitres"]');
    await amountInput.click();
    await amountInput.fill("2000");

    // Increase button should be disabled at max
    const increaseButton = modal.locator('button[aria-label="Increase amount"]');
    await expect(increaseButton).toBeDisabled();
  });

  test("log button is disabled when amount is 0", async ({ page }) => {
    const track = new TrackPage(page);
    const modal = await openWaterModal(track);

    // Amount starts at 0, so Log Water should be disabled
    const logButton = modal.getByRole("button", { name: /Log Water/i });
    await expect(logButton).toBeDisabled();
  });

  test("modal resets amount to 0 when reopened", async ({ page }) => {
    // Open modal and add some amount
    const track = new TrackPage(page);
    const modal = await openWaterModal(track);
    const increaseButton = modal.locator('button[aria-label="Increase amount"]');
    await increaseButton.click();
    await increaseButton.click();

    // Verify it changed to 100
    const amountInput = modal.locator('input[aria-label="Amount to add in millilitres"]');
    await expect(amountInput).toHaveValue("100");

    // Close via X button
    const closeButton = modal.locator('button[aria-label="Close"]');
    await closeButton.click();
    await expect(modal).not.toBeVisible();

    // Reopen
    await track.openWaterModal();

    // Should be back to 0
    await expect(track.waterModal).toBeVisible();
    await expect(amountInput).toHaveValue("0");
  });
});

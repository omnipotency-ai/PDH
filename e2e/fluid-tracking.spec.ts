import { expect, test } from "./fixtures";
import { TrackPage } from "./page-objects";

/**
 * E2E tests for fluid tracking in the post-NutritionCard flow.
 *
 * Tests:
 * 1. NutritionCard exposes water logging affordances
 * 2. Can log water
 * 3. Can log a non-water drink through NutritionCard search
 * 4. Fluid total updates after multiple water entries
 */
test.describe("Fluid tracking", () => {
  const parseFluidsTotalMl = (label: string | null) => {
    const match = label?.match(/Fluids:\s*([0-9.]+)\s*ml/i);
    return Number.parseFloat(match?.[1] ?? "0");
  };

  test("nutrition card exposes water logging affordances", async ({ page }) => {
    const track = new TrackPage(page);
    await track.goto();

    await expect(track.nutritionCard.locator('button[aria-label="Log water"]')).toBeVisible();
    await expect(track.waterProgress).toBeVisible();
  });

  test("can log water", async ({ page }) => {
    const track = new TrackPage(page);
    await track.goto();

    await track.openWaterModal();

    const modal = track.waterModal;
    await expect(modal).toBeVisible();

    const amountInput = modal.locator('input[aria-label="Amount to add in millilitres"]');
    await amountInput.fill("200");
    await expect(modal.getByRole("button", { name: /Log Water/i })).toBeEnabled();

    const logButton = modal.getByRole("button", { name: /Log Water/i });
    await logButton.click();

    // Fluids group should show in Today's Log
    const fluidsGroupButton = page.locator("button", { hasText: /^Fluids/ }).first();
    await expect(fluidsGroupButton).toBeVisible();
  });

  test("can log a non-water drink through NutritionCard search", async ({ page }) => {
    const track = new TrackPage(page);
    await track.goto();

    await track.openSearch("clear broth");
    await track.addSearchResultToStaging(/clear broth/i);
    await track.waitForLogFoodButtonText("1");
    await track.openLogFoodModal();

    const modal = track.logFoodModal;
    await modal.locator('[data-slot="log-food-actions"]').getByText("Log Food", { exact: true }).click();
    await expect(track.searchInput).toHaveValue("");

    const foodGroupButton = page.locator("button", { hasText: /Food intake/i }).first();
    await expect(foodGroupButton).toBeVisible();
    await foodGroupButton.click();

    await expect(page.locator("text=Clear broth").first()).toBeVisible();
  });

  test("fluid total updates after multiple entries", async ({ page }) => {
    const track = new TrackPage(page);
    await track.goto();

    // Log first water entry (200ml)
    await track.openWaterModal();
    let modal = track.waterModal;
    await expect(modal).toBeVisible();
    const beforeFirstLabel = await track.waterProgress.getAttribute("aria-label");
    const beforeFirstTotalMl = parseFluidsTotalMl(beforeFirstLabel);
    await modal.locator('input[aria-label="Amount to add in millilitres"]').fill("200");
    await expect(modal.getByRole("button", { name: /Log Water/i })).toBeEnabled();
    await modal.getByRole("button", { name: /Log Water/i }).click();
    await expect
      .poll(async () => {
        const label = await track.waterProgress.getAttribute("aria-label");
        return parseFluidsTotalMl(label) - beforeFirstTotalMl;
      }, { timeout: 10000 })
      .toBeGreaterThanOrEqual(200);

    // Log second water entry (400ml)
    await track.openWaterModal();
    modal = track.waterModal;
    await expect(modal).toBeVisible();
    const beforeSecondLabel = await track.waterProgress.getAttribute("aria-label");
    const beforeSecondTotalMl = parseFluidsTotalMl(beforeSecondLabel);
    await modal.locator('input[aria-label="Amount to add in millilitres"]').fill("400");
    await expect(modal.getByRole("button", { name: /Log Water/i })).toBeEnabled();
    await modal.getByRole("button", { name: /Log Water/i }).click();
    await expect
      .poll(async () => {
        const label = await track.waterProgress.getAttribute("aria-label");
        return parseFluidsTotalMl(label) - beforeSecondTotalMl;
      }, { timeout: 10000 })
      .toBeGreaterThanOrEqual(400);
  });
});

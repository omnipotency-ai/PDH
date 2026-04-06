import { expect, type Locator, type Page } from "@playwright/test";

export class TrackPage {
  readonly root: Locator;
  readonly nutritionCard: Locator;
  readonly searchInput: Locator;
  readonly searchResults: Locator;
  readonly logFoodButton: Locator;
  readonly calorieRing: Locator;
  readonly waterButton: Locator;
  readonly waterProgress: Locator;
  readonly mealSlotLabel: Locator;
  readonly collapsedView: Locator;
  readonly logFoodModal: Locator;
  readonly waterModal: Locator;

  constructor(readonly page: Page) {
    this.root = page.locator("#root");
    this.nutritionCard = page.locator('[data-slot="nutrition-card"]');
    this.searchInput = this.nutritionCard.getByLabel("Search foods").first();
    this.searchResults = this.nutritionCard.locator('[data-slot="search-results"]');
    this.logFoodButton = this.nutritionCard.locator('[data-slot="log-food-button"]');
    this.calorieRing = this.nutritionCard.locator('[data-slot="calorie-ring"]');
    this.waterButton = this.nutritionCard.locator('button[aria-label="Log water"]');
    this.waterProgress = this.nutritionCard.locator('[data-slot="water-progress"]');
    this.mealSlotLabel = this.nutritionCard.locator('[data-slot="meal-slot-label"]');
    this.collapsedView = this.nutritionCard.locator('[data-slot="collapsed-view"]');
    this.logFoodModal = page.locator('[data-slot="log-food-modal"]');
    this.waterModal = page.locator('[data-slot="water-modal"]');
  }

  async goto() {
    await this.page.goto("/");
    await expect(this.root).toBeVisible();
    await expect(this.nutritionCard).toBeVisible();
  }

  async openSearch(query: string) {
    await this.searchInput.fill(query);
    await expect(this.searchResults).toBeVisible();
  }

  getSearchResult(hasText: string | RegExp) {
    return this.searchResults.locator('[data-slot="search-result"]', { hasText });
  }

  async addSearchResultToStaging(hasText: string | RegExp) {
    const result = this.getSearchResult(hasText);
    await expect(result).toBeVisible();
    await result.locator('button[aria-label$="to staging"]').click();
    return result;
  }

  async openLogFoodModal() {
    await expect(this.logFoodButton).toBeVisible();
    await this.logFoodButton.click();
    await expect(this.logFoodModal).toBeVisible();
    return this.logFoodModal;
  }

  async openWaterModal() {
    await expect(this.waterProgress).toBeVisible();
    await this.waterProgress.click();
    await expect(this.waterModal).toBeVisible();
    return this.waterModal;
  }

  async openWaterModalFromHeader() {
    await expect(this.waterButton).toBeVisible();
    await this.waterButton.click();
    await expect(this.waterModal).toBeVisible();
    return this.waterModal;
  }

  async waitForLogFoodButtonText(text: string | RegExp) {
    await expect(this.logFoodButton).toContainText(text);
  }

  async waitForTextChange(locator: Locator, beforeText: string | null) {
    await expect(locator).not.toHaveText(beforeText ?? "");
  }
}

export class QuickCapturePage {
  readonly root: Locator;
  readonly quickCapture: Locator;
  readonly sleepTile: Locator;
  readonly weightTile: Locator;

  constructor(readonly page: Page) {
    this.root = page.locator("#root");
    this.quickCapture = page.locator('[data-slot="quick-capture"]');
    this.sleepTile = this.quickCapture.getByRole("button", { name: /^Sleep:/ }).first();
    this.weightTile = this.quickCapture.locator('button[aria-label^="Weigh-in quick capture"]');
  }

  async goto() {
    await this.page.goto("/");
    await expect(this.root).toBeVisible();
    await expect(this.quickCapture).toBeVisible();
  }

  async openSleepPopover() {
    const hoursInput = this.page.locator("#duration-popover-hours");
    const minsInput = this.page.locator("#duration-popover-mins");

    for (let attempt = 0; attempt < 3; attempt++) {
      await this.sleepTile.click();
      try {
        await expect(hoursInput).toBeVisible({ timeout: 2500 });
        await expect(minsInput).toBeVisible({ timeout: 2500 });
        return { hoursInput, minsInput };
      } catch (error) {
        if (attempt === 2) throw error;
        await this.page.keyboard.press("Escape").catch(() => {});
      }
    }

    return { hoursInput, minsInput };
  }

  async openWeightDrawer() {
    const weightInput = this.page.locator("#weight-popover-value, #weight-popover-stones").first();
    const description = this.page.getByText("Type weight, press Enter.");

    for (let attempt = 0; attempt < 3; attempt++) {
      await this.weightTile.scrollIntoViewIfNeeded();
      await this.weightTile.click({ force: true });
      if (attempt > 0) {
        await this.weightTile.focus();
        await this.page.keyboard.press(attempt === 1 ? "Enter" : "Space");
      }

      try {
        await expect(description).toBeVisible({ timeout: 2500 });
        await expect(weightInput).toBeVisible({ timeout: 2500 });
        return weightInput;
      } catch (error) {
        if (attempt === 2) throw error;
        await this.page.keyboard.press("Escape").catch(() => {});
      }
    }

    throw new Error("Failed to open weight drawer");
  }
}

import { expect, test } from "./fixtures";
import { TrackPage } from "./page-objects";

test.describe("Track page", () => {
  test("Track page loads and shows the nutrition card search input", async ({ page }) => {
    const track = new TrackPage(page);
    await track.goto();
    await expect(track.searchInput).toBeVisible();
  });

  test("track page exposes water logging affordances", async ({ page }) => {
    const track = new TrackPage(page);
    await track.goto();

    await expect(track.nutritionCard.locator('button[aria-label="Log water"]')).toBeVisible();
    await expect(track.waterProgress).toBeVisible();
  });
});

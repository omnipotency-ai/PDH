import { expect, test } from "./fixtures";

test.describe("Settings page", () => {
  test("Settings page loads with Health Profile section", async ({ page }) => {
    await page.goto("/settings");

    // Should see the Health Profile section (may be multiple on mobile + desktop)
    await expect(page.getByText(/Health Profile/i).first()).toBeVisible();
  });

  test("Settings page shows App & Data section", async ({ page }) => {
    await page.goto("/settings");

    // Should see the App & Data section (may be multiple on mobile + desktop)
    await expect(page.getByText(/App & Data/i).first()).toBeVisible();
  });

  test("Settings page shows privacy and cloud sync messaging", async ({ page }) => {
    await page.goto("/settings");

    await expect(page.getByText(/Privacy by default/i).first()).toBeVisible();
    await expect(
      page.getByText(/AI access is configured at the app level for this private deployment/i),
    ).toBeVisible();
    await expect(
      page.getByText(/Settings changes are saved to the cloud immediately/i),
    ).toBeVisible();
  });
});

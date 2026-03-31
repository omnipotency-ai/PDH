import { expect, test } from "./fixtures";

test.describe("Track page", () => {
  test("Track page loads and shows food input", async ({ page }) => {
    // Track is the default page at /
    await page.goto("/");

    // Should see the FoodSection with its placeholder
    await expect(page.getByPlaceholder("eg. Ham sandwich")).toBeVisible();
  });

  test("fluid tracking section is visible", async ({ page }) => {
    await page.goto("/");

    // FluidSection should be present with its title
    await expect(page.getByText("Fluids").first()).toBeVisible();
  });
});

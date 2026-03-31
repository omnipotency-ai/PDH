import { expect, test } from "./fixtures";

test.describe("App loads authenticated", () => {
  test("authenticated user sees the app (not a sign-in page)", async ({ page }) => {
    await page.goto("/");

    // Should see the main app header with logo (may be multiple, check first)
    await expect(page.getByRole("img", { name: "PDH" }).first()).toBeVisible();

    // Should NOT see sign-in button (that appears on the unauthenticated state)
    await expect(page.getByRole("button", { name: "Sign in" })).not.toBeVisible();
  });

  test("navigation has Track, Patterns, Settings links", async ({ page }) => {
    await page.goto("/");

    // Navigation menu should have the three main sections
    // Use .first() since there may be mobile + desktop nav
    await expect(page.getByRole("link", { name: "Track" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Patterns" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Settings" }).first()).toBeVisible();
  });
});

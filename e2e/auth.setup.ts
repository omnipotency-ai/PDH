import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { clerk, clerkSetup } from "@clerk/testing/playwright";
import { expect, test as setup } from "@playwright/test";
import { config } from "dotenv";

// Load env vars - Playwright doesn't load Vite's env files automatically
config({ path: ".env.local" });

const STORAGE_STATE = ".playwright/auth/user.json";

// Strip quotes from env var if present (some .env parsers include them)
function cleanEnvVar(value: string | undefined): string | undefined {
  return value?.replace(/^"|"$/g, "");
}

setup.describe.configure({ mode: "serial" });

setup("obtain Clerk Testing Token", async () => {
  await clerkSetup();
});

setup("sign in test user and save storageState", async ({ page }) => {
  const email = cleanEnvVar(process.env.E2E_CLERK_USER_EMAIL);

  if (!email) {
    throw new Error("E2E_CLERK_USER_EMAIL must be set in .env.local");
  }

  // Navigate to app so Clerk can intercept
  await page.goto("/");

  // Sign in using Clerk's testing helper
  // Use the simpler emailAddress param which auto-resolves the sign-in strategy
  // For test users with +clerk_test suffix, this uses magic code 424242 automatically
  await clerk.signIn({
    page,
    emailAddress: email,
  });

  // Wait for authenticated state
  await expect(page.locator("body")).toBeVisible();

  // Ensure storage directory exists
  await mkdir(dirname(STORAGE_STATE), { recursive: true });

  // Save storage state for other tests to use
  await page.context().storageState({ path: STORAGE_STATE });
});

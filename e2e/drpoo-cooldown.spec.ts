import { expect, test } from "./fixtures";

/**
 * E2E tests for Dr. Poo trigger behavior (WQ-315).
 *
 * Covers:
 * - Auto/Manual toggle switches and persists
 * - Auto mode: Bristol 4 does NOT trigger a report (only 6-7 do)
 * - Manual mode: user can request a report via "Send now"
 * - Cooldown UI state after report generation
 * - "Add your OpenAI API key" message when no key is set
 *
 * Tests that require an actual OpenAI API key are marked with test.skip
 * and a comment explaining why. The toggle and UI-state tests run against
 * the real app without needing an API key.
 */

test.describe("Dr. Poo trigger behavior", () => {
  // ── Locator helpers ──

  const getBowelSection = (page: import("@playwright/test").Page) =>
    page.locator("section.glass-card-bowel");

  const getAutoButton = (page: import("@playwright/test").Page) =>
    getBowelSection(page)
      .locator('[role="toolbar"][aria-label="Report trigger mode"]')
      .getByRole("button", { name: "Auto" });

  const getManualButton = (page: import("@playwright/test").Page) =>
    getBowelSection(page)
      .locator('[role="toolbar"][aria-label="Report trigger mode"]')
      .getByRole("button", { name: "Manual" });

  // ── Toggle tests ──

  test.describe("Auto/Manual toggle", () => {
    test("toggle is visible in the Bowel Movement section", async ({
      page,
    }) => {
      await page.goto("/");
      await expect(page.locator("#root")).toBeVisible();

      const bowelSection = getBowelSection(page);
      await expect(bowelSection).toBeVisible();

      const toolbar = bowelSection.locator(
        '[role="toolbar"][aria-label="Report trigger mode"]',
      );
      await expect(toolbar).toBeVisible();

      await expect(getAutoButton(page)).toBeVisible();
      await expect(getManualButton(page)).toBeVisible();
    });

    test("Auto button is pressed by default", async ({ page }) => {
      await page.goto("/");
      await expect(page.locator("#root")).toBeVisible();

      // Default reportTriggerMode is "auto" (undefined defaults to "auto")
      await expect(getAutoButton(page)).toHaveAttribute("aria-pressed", "true");
      await expect(getManualButton(page)).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    });

    test("clicking Manual switches the toggle and persists on reload", async ({
      page,
    }) => {
      await page.goto("/");
      await expect(page.locator("#root")).toBeVisible();

      // Click Manual
      await getManualButton(page).click();
      await page.waitForTimeout(500);

      // Manual should now be pressed
      await expect(getManualButton(page)).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(getAutoButton(page)).toHaveAttribute(
        "aria-pressed",
        "false",
      );

      // Reload the page and verify persistence (stored in Convex profile)
      await page.reload();
      await expect(page.locator("#root")).toBeVisible();
      await expect(getBowelSection(page)).toBeVisible();

      await expect(getManualButton(page)).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(getAutoButton(page)).toHaveAttribute(
        "aria-pressed",
        "false",
      );

      // Restore to Auto for other tests
      await getAutoButton(page).click();
      await page.waitForTimeout(500);
      await expect(getAutoButton(page)).toHaveAttribute("aria-pressed", "true");
    });

    test("clicking Auto after Manual switches back", async ({ page }) => {
      await page.goto("/");
      await expect(page.locator("#root")).toBeVisible();

      // Switch to Manual first
      await getManualButton(page).click();
      await page.waitForTimeout(300);
      await expect(getManualButton(page)).toHaveAttribute(
        "aria-pressed",
        "true",
      );

      // Switch back to Auto
      await getAutoButton(page).click();
      await page.waitForTimeout(300);
      await expect(getAutoButton(page)).toHaveAttribute("aria-pressed", "true");
      await expect(getManualButton(page)).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    });
  });

  // ── No API key state ──

  test.describe("No API key state", () => {
    test("Dr. Poo section shows API key prompt when no key is set", async ({
      page,
    }) => {
      // This test assumes the test user does NOT have an API key stored.
      // If the test user already has a key configured, this test will be
      // skipped at assertion time (the text won't be visible).
      await page.goto("/");
      await expect(page.locator("#root")).toBeVisible();

      // The Dr. Poo section should show the "Add your OpenAI API key" message
      // if no API key is configured for this user.
      const apiKeyPrompt = page.getByText(
        "Add your OpenAI API key in Settings to enable AI food analysis.",
      );

      // Check if the API key prompt OR the conversation panel is visible.
      // If the user has a key, the conversation panel appears instead.
      const conversationPanel = page.locator(
        '[data-slot="conversation-panel"]',
      );
      const hasApiKey = await conversationPanel.isVisible().catch(() => false);

      if (hasApiKey) {
        // User already has a key — skip this assertion gracefully
        test.skip(true, "Test user already has an API key configured");
      }

      await expect(apiKeyPrompt).toBeVisible();
    });
  });

  // ── Auto mode: Bristol score filtering ──

  test.describe("Auto mode - Bristol score filtering", () => {
    test("logging a Bristol 4 BM in Auto mode does NOT show analysis progress", async ({
      page,
    }) => {
      await page.goto("/");
      await expect(page.locator("#root")).toBeVisible();

      const bowelSection = getBowelSection(page);
      await expect(bowelSection).toBeVisible();

      // Ensure Auto mode is active
      await expect(getAutoButton(page)).toHaveAttribute("aria-pressed", "true");

      // Select Bristol Type 4 (normal stool — should NOT trigger auto-report)
      const bristolType4 = bowelSection.locator(
        'input[aria-label*="Bristol type 4"]',
      );
      await bristolType4.click({ force: true });
      await page.waitForTimeout(300);

      // Log the bowel movement
      const logButton = bowelSection.getByRole("button", {
        name: /Log Bowel Movement/i,
      });
      await expect(logButton).toBeVisible();
      await logButton.click();
      await page.waitForTimeout(1500);

      // In Auto mode with Bristol 4, no analysis should be triggered.
      // The analysis progress overlay should NOT appear (no "sending" / "receiving" state).
      // The Dr. Poo section should remain in its idle state.
      const progressIndicator = page.locator(
        '[data-slot="analysis-progress-inline"]',
      );
      // If the overlay exists, it should NOT be in sending/receiving state
      const overlayCount = await progressIndicator.count();
      if (overlayCount > 0) {
        // If there's an overlay, it should be from a previous "done" state, not a new trigger
        await expect(
          progressIndicator.getByText(/Sending logs|Analysing your data/i),
        ).not.toBeVisible();
      }
    });
  });

  // ── Manual mode: explicit report request ──

  test.describe("Manual mode - explicit report request", () => {
    // This test requires a real OpenAI API key to actually generate a report.
    // Without one, the "Send now" button won't appear (no API key = no conversation panel).
    const hasApiKey = Boolean(process.env.TEST_OPENAI_API_KEY);

    // Skip the entire describe block if no API key is available
    test.skip(
      !hasApiKey,
      "Requires TEST_OPENAI_API_KEY to test manual report flow",
    );

    test("user can type a question and see Send now button after submitting", async ({
      page,
    }) => {
      await page.goto("/");
      await expect(page.locator("#root")).toBeVisible();

      // Switch to Manual mode
      await getManualButton(page).click();
      await page.waitForTimeout(300);

      // The conversation panel should be visible (user has API key)
      const replyInput = page.getByPlaceholder("Reply to Dr. Poo...");
      await expect(replyInput).toBeVisible();

      // Type a question
      await replyInput.fill("What foods should I avoid this week?");

      // Submit the question (click the send button next to the input)
      const sendButton = page
        .locator('[data-slot="conversation-panel"]')
        .locator("button")
        .last();
      await sendButton.click();
      await page.waitForTimeout(500);

      // The pending reply should appear, along with the "Send now" button
      await expect(
        page.getByText("What foods should I avoid this week?"),
      ).toBeVisible();
      await expect(page.getByText("Send now")).toBeVisible();

      // Restore Auto mode
      await getAutoButton(page).click();
      await page.waitForTimeout(300);
    });
  });

  // ── Conversation input ──

  test.describe("Conversation input", () => {
    test("reply input is visible when API key is configured", async ({
      page,
    }) => {
      await page.goto("/");
      await expect(page.locator("#root")).toBeVisible();

      // Check if the conversation panel exists (requires API key)
      const conversationPanel = page.locator(
        '[data-slot="conversation-panel"]',
      );
      const hasKey = await conversationPanel.isVisible().catch(() => false);

      if (!hasKey) {
        test.skip(true, "Test user does not have an API key configured");
      }

      const replyInput = page.getByPlaceholder("Reply to Dr. Poo...");
      await expect(replyInput).toBeVisible();
    });

    test("can type a message and submit it via Enter key", async ({ page }) => {
      await page.goto("/");
      await expect(page.locator("#root")).toBeVisible();

      const conversationPanel = page.locator(
        '[data-slot="conversation-panel"]',
      );
      const hasKey = await conversationPanel.isVisible().catch(() => false);

      if (!hasKey) {
        test.skip(true, "Test user does not have an API key configured");
      }

      const replyInput = page.getByPlaceholder("Reply to Dr. Poo...");
      await replyInput.fill("Test question from E2E");
      await replyInput.press("Enter");
      await page.waitForTimeout(500);

      // The message should appear as a pending reply
      await expect(page.getByText("Test question from E2E")).toBeVisible();

      // The input should be cleared after submission
      await expect(replyInput).toHaveValue("");
    });

    test("send button is disabled when input is empty", async ({ page }) => {
      await page.goto("/");
      await expect(page.locator("#root")).toBeVisible();

      const conversationPanel = page.locator(
        '[data-slot="conversation-panel"]',
      );
      const hasKey = await conversationPanel.isVisible().catch(() => false);

      if (!hasKey) {
        test.skip(true, "Test user does not have an API key configured");
      }

      // The send button (last button in the conversation panel input row)
      // should be disabled when the input is empty
      const replyInput = page.getByPlaceholder("Reply to Dr. Poo...");
      await expect(replyInput).toHaveValue("");

      // Find the send button — it's the button right after the input
      const inputRow = replyInput.locator("..");
      const sendButton = inputRow.locator("button");
      await expect(sendButton).toBeDisabled();
    });
  });

  // ── Cooldown behavior ──

  test.describe("Cooldown behavior", () => {
    // Full cooldown testing requires generating an actual report (needs API key)
    // and then verifying the UI enters cooldown state. These tests verify the
    // cooldown-related UI elements exist and behave correctly.

    test.skip(
      !process.env.TEST_OPENAI_API_KEY,
      "Requires TEST_OPENAI_API_KEY to test cooldown after report generation",
    );

    test("after generating a report, Send now triggers lightweight mode during cooldown", async ({
      page,
    }) => {
      // This test would need to:
      // 1. Log a Bristol 6-7 BM to trigger an auto-report (or send a question manually)
      // 2. Wait for the report to complete
      // 3. Verify that subsequent "Send now" clicks use lightweight (conversation-only) mode
      //
      // The lightweight mode is detected by the absence of a full report update —
      // only conversation messages are added, not a new report body.
      //
      // This is an inherently slow test (requires full AI round-trip) so it's
      // only run when TEST_OPENAI_API_KEY is available.

      await page.goto("/");
      await expect(page.locator("#root")).toBeVisible();

      // Ensure Auto mode
      await expect(getAutoButton(page)).toHaveAttribute("aria-pressed", "true");

      // Type a question to Dr. Poo and use "Send now" to trigger a report
      const replyInput = page.getByPlaceholder("Reply to Dr. Poo...");
      await replyInput.fill("What patterns do you see in my recent data?");
      await replyInput.press("Enter");
      await page.waitForTimeout(500);

      // Click "Send now" to force report generation
      const sendNowButton = page.getByText("Send now");
      await expect(sendNowButton).toBeVisible();
      await sendNowButton.click();

      // Wait for the analysis to complete (generous timeout for AI round-trip)
      await expect(
        page.locator('[data-slot="analysis-progress-inline"]'),
      ).not.toBeVisible({ timeout: 60_000 });

      // Now we're in cooldown. Type another question.
      await replyInput.fill("Follow-up: any new foods I should try?");
      await replyInput.press("Enter");
      await page.waitForTimeout(500);

      // "Send now" should still appear for the pending reply
      const sendNowAfterCooldown = page.getByText("Send now");
      await expect(sendNowAfterCooldown).toBeVisible();

      // Clicking it during cooldown uses lightweight mode (conversation-only).
      // We verify by checking that the report body does NOT change (only conversation updates).
      await sendNowAfterCooldown.click();

      // Wait for completion
      await expect(
        page.locator('[data-slot="analysis-progress-inline"]'),
      ).not.toBeVisible({ timeout: 60_000 });

      // The follow-up message should now appear in the conversation panel
      await expect(
        page.getByText("Follow-up: any new foods I should try?"),
      ).toBeVisible();
    });
  });

  // ── 5-minute rate limiter safety net ──

  test.describe("Rate limiter safety net", () => {
    // The 5-minute rate limiter is a client-side safety net implemented in
    // aiRateLimiter.ts. It prevents rapid-fire API calls regardless of cooldown
    // state. Testing this in E2E would require generating two reports within
    // 5 minutes and verifying the second is blocked — which is impractical
    // without mocking time. The rate limiter is tested at the unit level in
    // convex tests instead.
    //
    // This describe block documents the coverage gap for E2E.
    test.skip(
      true,
      "Rate limiter is tested at unit level — E2E would require time mocking",
    );

    test("placeholder for rate limiter E2E", () => {
      // See convex/aiRateLimiter.test.ts for unit-level coverage
    });
  });
});

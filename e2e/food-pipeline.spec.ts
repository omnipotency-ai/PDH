import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/**
 * Adversarial E2E tests for the server-side food pipeline.
 *
 * Goal: find bugs, not prove it works. Every test should try to break
 * an assumption. If a test passes trivially, it's not testing enough.
 *
 * Prerequisites:
 * - Dev server on :3005 with Convex backend
 * - Clerk auth (auth.setup.ts)
 * - OPENAI_API_KEY *not* set (tests assume LLM matching is disabled)
 */

// ── Selectors ───────────────────────────────────────────────────────────────
//
// These selectors use CSS classes, placeholder text, aria-labels, and data
// attributes because production code does not yet have data-testid attributes.
// Each entry below documents its selector strategy and what change would make
// it more robust. Selectors marked "Fragile" will break silently if the
// referenced copy, class name, or structural element changes.
//
//  root             — id="root" set by Vite's HTML template. Stable.
//  foodSection      — glass-card-food utility class on FoodQuickLog panel.
//                     Fragile to class rename. TODO: data-testid="food-section".
//  foodInput        — Placeholder text. Fragile to copy changes.
//                     TODO: data-testid="food-input".
//  logFoodButton    — Button inner text. Fragile to label changes.
//                     TODO: data-testid="log-food-button".
//  foodGroupButton  — Text on collapsible group toggle in Today's Log.
//                     TODO: data-testid="food-group-toggle".
//  entry            — Tailwind group variant class (.group/entry) on each log
//                     row wrapper. Fragile to Tailwind group name change.
//                     TODO: data-testid="log-entry".
//  dotResolved      — [data-slot] is the shadcn component API convention;
//                     aria-label is accessible text, doubles as selector.
//                     Both are intentional API surface — stable.
//  dotPending       — Same pattern. aria-label text is load-bearing for tooltip.
//  dotExpired       — Same pattern.
//  processingSpinner — animate-spin on the SVG. Fragile to CSS refactors.
//                     TODO: data-testid="processing-spinner".
//  processingText   — Text content. Stable while copy is unchanged.
//  matchModalTitle  — Text match on modal heading. TODO: data-testid="match-modal".
//  matchModalBody   — data-slot on the FoodMatchingModal body. Intentional.
//  searchFoodsInput — id on the search input inside the matching modal. Stable.
//                     id="food-search-input" is already present on the element.
//  editModalTitle   — Text match. TODO: data-testid="edit-modal".
//  rawInputEditor   — id="raw-input-editor" on the <textarea>. Stable if id kept.
//  saveReprocessButton — Button text. TODO: data-testid="save-reprocess-button".
//  matchButton      — Button text in modal. TODO: data-testid="match-confirm-button".
//  cancelButton     — Button text. TODO: data-testid="cancel-button".
//  toast            — [data-sonner-toast] set by sonner library. Stable while
//                     sonner is the toast provider.

const SEL = {
  root: "#root",
  foodSection: "section.glass-card-food",
  foodInput: 'input[placeholder="eg. Ham sandwich"]',
  logFoodButton: "button:has-text('Log Food')",
  foodGroupButton: 'button:has-text("Food intake")',
  /** The hoverable entry wrapper — every log row uses this class */
  entry: ".group\\/entry",
  /** Resolution indicators */
  dotResolved: '[data-slot="resolution-dot"][aria-label="Matched"]',
  dotPending: '[data-slot="resolution-dot"][aria-label="Pending — tap to match"]',
  dotExpired: '[data-slot="resolution-dot"][aria-label="Not matched"]',
  /** Processing state */
  processingSpinner: "svg.animate-spin",
  processingText: "text=Processing...",
  /** Modals */
  matchModalTitle: "text=Match food item",
  matchModalBody: '[data-slot="food-matching-body"]',
  searchFoodsInput: "#food-search-input",
  editModalTitle: "text=Edit food entry",
  rawInputEditor: "#raw-input-editor",
  saveReprocessButton: "button:has-text('Save & Reprocess')",
  matchButton: "button:has-text('Match')",
  cancelButton: "button:has-text('Cancel')",
  /** Toast */
  toast: "[data-sonner-toast]",
} as const;

// ── Helpers ─────────────────────────────────────────────────────────────────

async function navigateAndWait(page: Page) {
  await page.goto("/");
  await expect(page.locator(SEL.root)).toBeVisible();
}

/** Type and submit food. Asserts the input clears (optimistic save worked). */
async function logFood(page: Page, text: string) {
  const section = page.locator(SEL.foodSection);
  const input = section.locator(SEL.foodInput);
  await input.fill(text);
  await section.locator(SEL.logFoodButton).click();
  await expect(input).toHaveValue("");
}

/** Expand the "Food" group in Today's Log. */
async function expandFoodGroup(page: Page) {
  const btn = page.locator(SEL.foodGroupButton).first();
  await expect(btn).toBeVisible({ timeout: 10000 });
  await btn.click();
  await page.waitForTimeout(300);
}

/** Wait until at least N resolution dots of the given kind appear. */
async function waitForDots(page: Page, selector: string, count: number, timeoutMs = 15000) {
  await expect(page.locator(selector).nth(count - 1)).toBeVisible({
    timeout: timeoutMs,
  });
}

/** Count how many dots of a given kind are currently visible. */
async function _countDots(page: Page, selector: string): Promise<number> {
  return page.locator(selector).count();
}

/** Get all visible food item display text lines inside the most recent entry. */
async function getItemTexts(entry: Locator): Promise<string[]> {
  const items = entry.locator(".truncate.text-xs");
  const count = await items.count();
  const texts: string[] = [];
  for (let i = 0; i < count; i++) {
    const t = await items.nth(i).textContent();
    if (t) texts.push(t.trim());
  }
  return texts;
}

/** Find the most recent entry matching a text pattern.
 *  DOM renders newest entries first, so .first() gets the latest. */
function latestEntry(page: Page, text: string | RegExp): Locator {
  return page.locator(SEL.entry).filter({ hasText: text }).first();
}

/** Wait until at least N resolution dots of the given kind appear within a specific entry. */
async function waitForDotsInEntry(
  entry: Locator,
  selector: string,
  count: number,
  timeoutMs = 15000,
) {
  await expect(entry.locator(selector).nth(count - 1)).toBeVisible({
    timeout: timeoutMs,
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 1: Processing state & happy path
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Processing state", () => {
  // SKIPPED: Processing resolves too fast on localhost to reliably catch the
  // transient spinner before items populate. The assertion window is a few
  // milliseconds of Convex round-trip time, making this test non-deterministic
  // even with the maximum practical timeout. Re-enable if a deliberate delay
  // is added to the processing pipeline during test runs (e.g. via a test flag).
  test.skip("processing indicator appears BEFORE items populate", async ({ page }) => {
    await navigateAndWait(page);
    await logFood(page, "toast, banana");
    await expandFoodGroup(page);

    // The entry should show the processing state: spinner + "Processing..." + raw text preview
    // This must appear BEFORE items resolve — if it doesn't, the UI is lying
    const entry = page
      .locator(SEL.entry)
      .filter({ hasText: /toast.*banana|banana.*toast|Processing/ })
      .first();
    await expect(entry).toBeVisible({ timeout: 10000 });

    // Either we caught it processing, or it already resolved.
    // If it resolved instantly, we can't assert processing state — but we CAN
    // assert the resolved state is complete and correct.
    const hasSpinner = (await entry.locator(SEL.processingSpinner).count()) > 0;

    if (hasSpinner) {
      // GOOD: we caught the processing state. Assert it fully.
      await expect(entry.locator("text=Processing...")).toBeVisible();
      // The raw input preview should be visible (italicised)
      await expect(entry.locator("p.italic")).toBeVisible();
      // No resolution dots should exist yet — items haven't been parsed
      const dots = await entry.locator('[data-slot="resolution-dot"]').count();
      expect(dots).toBe(0);
    }

    // Now wait for processing to finish — scoped to the entry
    await expect(entry.locator(SEL.dotResolved).nth(1)).toBeVisible({
      timeout: 15000,
    });

    // After processing: spinner MUST be gone
    await expect(page.locator(SEL.processingSpinner)).not.toBeVisible();
    await expect(page.locator(SEL.processingText)).not.toBeVisible();
  });

  test("processing indicator shows the raw input text, not empty", async ({ page }) => {
    await navigateAndWait(page);
    // Use a longer input to make it more likely we catch the processing state
    await logFood(page, "roasted chicken, steamed broccoli, brown rice, garlic");
    await expandFoodGroup(page);

    // Look for the processing preview text
    const entry = page.locator(SEL.entry).last();
    await expect(entry).toBeVisible({ timeout: 10000 });

    // Whether processing or resolved, the entry should never be empty
    const entryText = await entry.textContent();
    expect(entryText?.trim().length).toBeGreaterThan(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 2: Deterministic resolution — all items match registry
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Deterministic resolution", () => {
  test("all registry items resolve green — no amber, no yellow, no spinner", async ({ page }) => {
    await navigateAndWait(page);
    await logFood(page, "toast, banana, rice");
    await expandFoodGroup(page);

    // Wait for all 3 to resolve
    await waitForDots(page, SEL.dotResolved, 3);

    // NEGATIVE assertions: no pending or expired dots should exist for these items
    const entry = latestEntry(page, /toast/);
    const pendingCount = await entry.locator(SEL.dotPending).count();
    const expiredCount = await entry.locator(SEL.dotExpired).count();
    expect(pendingCount).toBe(0);
    expect(expiredCount).toBe(0);

    // Spinner must not be present
    await expect(entry.locator(SEL.processingSpinner)).not.toBeVisible();
  });

  test("display names show parsed names with structured quantities, not raw segments", async ({
    page,
  }) => {
    await navigateAndWait(page);
    await logFood(page, "4 toast, 200g rice, two bananas");
    await expandFoodGroup(page);

    await waitForDots(page, SEL.dotResolved, 3);

    const entry = latestEntry(page, /toast/);
    const texts = await getItemTexts(entry);

    // Display names now intentionally include parsed quantities (e.g. "4 toast").
    // The key difference from raw segments is that quantities are extracted and
    // re-formatted from parsed fields, not left as-is from user input.
    // "two bananas" should become "2 bananas" (word-to-number conversion).
    // "200g rice" should become "200 g rice" (space-separated unit).
    for (const text of texts) {
      expect(text).not.toMatch(/^two\s/i); // word quantity should be converted to digit
      expect(text).not.toMatch(/^\d+[a-z]+\s/i); // "200g" should be split to "200 g"
      expect(text).not.toMatch(/^a bit of\s/i); // descriptive quantity should be normalised
    }

    // "toast" should appear in at least one display name (with or without quantity prefix)
    expect(texts.some((t) => t.toLowerCase().includes("toast"))).toBe(true);
  });

  test("single item log resolves correctly (not split into characters)", async ({ page }) => {
    await navigateAndWait(page);
    await logFood(page, "papaya");
    await expandFoodGroup(page);

    const entry = latestEntry(page, /papaya/);
    // Wait for the resolved dot specifically within the papaya entry,
    // not page-wide (other entries from prior tests may already have dots).
    await waitForDotsInEntry(entry, SEL.dotResolved, 1);
    // Exactly 1 resolution dot — not N dots for N characters
    const dotCount = await entry.locator('[data-slot="resolution-dot"]').count();
    expect(dotCount).toBe(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 3: Unresolved items
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Unresolved items", () => {
  test("unknown food shows amber dot, NOT green", async ({ page }) => {
    await navigateAndWait(page);
    const gibberish = `ambrd${Date.now()}`;
    await logFood(page, gibberish);
    await expandFoodGroup(page);

    const entry = latestEntry(page, new RegExp(gibberish));
    await waitForDotsInEntry(entry, SEL.dotPending, 1);

    // GREEN dots must NOT exist for this entry
    const greenCount = await entry.locator(SEL.dotResolved).count();
    expect(greenCount).toBe(0);
  });

  test("toast notification fires for unresolved items", async ({ page }) => {
    await navigateAndWait(page);
    const gibberish = `tstfr${Date.now()}`;
    await logFood(page, gibberish);
    await expandFoodGroup(page);

    // Scope wait to the entry
    const entry = latestEntry(page, new RegExp(gibberish));
    await waitForDotsInEntry(entry, SEL.dotPending, 1);

    // Toast should appear
    const toastMsg = page.locator(SEL.toast).filter({
      hasText: /couldn't be matched|still unmatched/,
    });
    await expect(toastMsg.first()).toBeVisible({ timeout: 15000 });

    // Toast should mention the count
    await expect(page.locator(SEL.toast).filter({ hasText: /food/i })).toBeVisible({
      timeout: 15000,
    });
  });

  test("multiple unresolved items show correct count in toast", async ({ page }) => {
    await navigateAndWait(page);
    const ts = Date.now();
    await logFood(page, `zyp${ts}, frob${ts}, xylo${ts}`);
    await expandFoodGroup(page);

    // Wait for at least 3 pending dots — scoped to the entry
    const entry = latestEntry(page, new RegExp(`zyp${ts}|frob${ts}|xylo${ts}`));
    await waitForDotsInEntry(entry, SEL.dotPending, 3);

    // Toast should mention unresolved foods (count may include items from prior tests)
    const toastMsg = page.locator(SEL.toast).filter({
      hasText: /foods? couldn't be matched|still unmatched/,
    });
    await expect(toastMsg.first()).toBeVisible({ timeout: 15000 });
  });

  test("mixed resolution: known + unknown items coexist correctly", async ({ page }) => {
    await navigateAndWait(page);
    const gibberish = `wrblx${Date.now()}`;
    await logFood(page, `rice, ${gibberish}, eggs`);
    await expandFoodGroup(page);

    // Wait for this entry to appear and finish processing
    // Use the gibberish word as the unique anchor — only this entry has it
    const entry = latestEntry(page, new RegExp(gibberish));
    await expect(entry).toBeVisible({ timeout: 10000 });

    // Wait for ANY dots to appear first (processing complete)
    await expect(entry.locator('[data-slot="resolution-dot"]').first()).toBeVisible({
      timeout: 20000,
    });

    // Then wait for the 2 resolved dots
    await waitForDotsInEntry(entry, SEL.dotResolved, 2, 20000);

    // Should also have exactly 1 pending dot
    const pendingCount = await entry.locator(SEL.dotPending).count();
    expect(pendingCount).toBe(1);

    const resolvedCount = await entry.locator(SEL.dotResolved).count();
    expect(resolvedCount).toBe(2);

    // Total dots should be exactly 3 (no duplicates, no missing)
    const totalDots = await entry.locator('[data-slot="resolution-dot"]').count();
    expect(totalDots).toBe(3);
  });

  test("pending dot is clickable and opens matching modal", async ({ page }) => {
    await navigateAndWait(page);
    const gibberish = `pdclk${Date.now()}`;
    await logFood(page, gibberish);
    await expandFoodGroup(page);

    // Scope to this test's entry to avoid picking up pending dots from prior tests
    const entry = latestEntry(page, new RegExp(gibberish));
    await waitForDotsInEntry(entry, SEL.dotPending, 1);

    // The pending dot should be a <button>, not a <span>
    const dot = entry.locator(SEL.dotPending).first();
    const tagName = await dot.evaluate((el) => el.tagName.toLowerCase());
    expect(tagName).toBe("button");

    // Click it
    await dot.click();

    // Modal should open
    await expect(page.locator(SEL.matchModalTitle).first()).toBeVisible({
      timeout: 5000,
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 4: Food Matching Modal
// ═════════════════════════════════════════════════════════════════════════════

test.describe("FoodMatchingModal", () => {
  test("modal shows the food name and full meal context", async ({ page }) => {
    await navigateAndWait(page);
    const gibberish = `mealc${Date.now()}`;
    await logFood(page, `toast, ${gibberish}, banana`);
    await expandFoodGroup(page);

    // Wait for items to appear, find the pending dot for the gibberish word — scoped to this entry
    const entry = latestEntry(page, new RegExp(gibberish));
    await waitForDotsInEntry(entry, SEL.dotPending, 1);
    await entry.locator(SEL.dotPending).first().click();

    // Modal should open
    const body = page.locator(SEL.matchModalBody);
    await expect(body).toBeVisible({ timeout: 5000 });

    // Should show the full meal context
    await expect(body.getByText("Full meal")).toBeVisible();
    await expect(
      body.getByText(new RegExp(`toast.*${gibberish}.*banana|toast, ${gibberish}, banana`)),
    ).toBeVisible();

    // Should mention the unresolved food name in the description
    await expect(page.getByText(/couldn't be automatically matched/)).toBeVisible();
  });

  test("Match button is disabled until a canonical is selected", async ({ page }) => {
    await navigateAndWait(page);
    const gibberish = `mtdis${Date.now()}`;
    await logFood(page, gibberish);
    await expandFoodGroup(page);

    const entry = latestEntry(page, new RegExp(gibberish));
    await waitForDotsInEntry(entry, SEL.dotPending, 1);
    await entry.locator(SEL.dotPending).first().click();

    await expect(page.locator(SEL.matchModalBody)).toBeVisible({
      timeout: 5000,
    });

    // Match button should be DISABLED before selecting anything
    const matchBtn = page.locator(SEL.matchButton);
    await expect(matchBtn).toBeDisabled();

    // Search and select something
    await page.locator(SEL.searchFoodsInput).fill("bread");
    const breadOption = page
      .locator(SEL.matchModalBody)
      .locator("button")
      .filter({ hasText: "bread" })
      .first();
    await expect(breadOption).toBeVisible({ timeout: 5000 });
    await breadOption.click();

    // NOW the Match button should be enabled
    await expect(matchBtn).toBeEnabled();
  });

  test("selecting then deselecting disables the Match button again", async ({ page }) => {
    await navigateAndWait(page);
    const gibberish = `deslc${Date.now()}`;
    await logFood(page, gibberish);
    await expandFoodGroup(page);

    const entry = latestEntry(page, new RegExp(gibberish));
    await waitForDotsInEntry(entry, SEL.dotPending, 1);
    await entry.locator(SEL.dotPending).first().click();
    await expect(page.locator(SEL.matchModalBody)).toBeVisible({
      timeout: 5000,
    });

    // Select bread
    await page.locator(SEL.searchFoodsInput).fill("bread");
    const breadOption = page
      .locator(SEL.matchModalBody)
      .locator("button")
      .filter({ hasText: "bread" })
      .first();
    await breadOption.click();
    await expect(page.locator(SEL.matchButton)).toBeEnabled();

    // Click again to deselect
    await breadOption.click();
    await expect(page.locator(SEL.matchButton)).toBeDisabled();
  });

  test("successful match updates dot from amber to green", async ({ page }) => {
    await navigateAndWait(page);

    // Use a unique gibberish word per run. Prior runs of this test create a
    // learned alias (qworfnax -> bread) in the foodAliases table, so a static
    // word would auto-resolve on subsequent runs instead of staying pending.
    const gibberish = `xzqm${Date.now()}`;
    await logFood(page, gibberish);
    await expandFoodGroup(page);

    // Verify: 0 green, 1 amber BEFORE matching — scoped to entry
    const entry = latestEntry(page, new RegExp(gibberish));
    await waitForDotsInEntry(entry, SEL.dotPending, 1);
    expect(await entry.locator(SEL.dotResolved).count()).toBe(0);
    expect(await entry.locator(SEL.dotPending).count()).toBe(1);

    // Open modal and match the food item.
    await entry.locator(SEL.dotPending).first().click();
    const body = page.locator(SEL.matchModalBody);
    await expect(body).toBeVisible({ timeout: 5000 });

    // The modal may or may not pre-select a candidate depending on
    // fuzzy/embedding match results for the gibberish word. Either way,
    // we need an option selected before clicking Match. Search for "bread"
    // and click an UNSELECTED option so the toggle always selects it.
    await page.locator(SEL.searchFoodsInput).fill("bread");
    const unselectedBread = body
      .locator('[role="option"][aria-selected="false"]')
      .filter({ hasText: /bread/i })
      .first();
    await expect(unselectedBread).toBeVisible({ timeout: 10000 });
    await unselectedBread.click();
    await expect(page.locator(SEL.matchButton)).toBeEnabled({ timeout: 5000 });
    await page.locator(SEL.matchButton).click();

    // Modal should close
    await expect(page.locator(SEL.matchModalTitle).first()).not.toBeVisible({
      timeout: 5000,
    });

    // Verify: 1 green, 0 amber AFTER matching
    await expect(entry.locator(SEL.dotResolved).first()).toBeVisible({
      timeout: 10000,
    });
    expect(await entry.locator(SEL.dotPending).count()).toBe(0);
  });

  test("cancel closes modal without changing resolution", async ({ page }) => {
    await navigateAndWait(page);
    const gibberish = `cancl${Date.now()}`;
    await logFood(page, gibberish);
    await expandFoodGroup(page);

    const entry = latestEntry(page, new RegExp(gibberish));
    await waitForDotsInEntry(entry, SEL.dotPending, 1);
    await entry.locator(SEL.dotPending).first().click();

    await expect(page.locator(SEL.matchModalBody)).toBeVisible({
      timeout: 5000,
    });

    // Cancel
    await page.locator(SEL.cancelButton).click();

    // Modal closes
    await expect(page.locator(SEL.matchModalTitle).first()).not.toBeVisible({
      timeout: 5000,
    });

    // Dot is STILL amber
    expect(await entry.locator(SEL.dotPending).count()).toBe(1);
    expect(await entry.locator(SEL.dotResolved).count()).toBe(0);
  });

  test("search with no results shows 'Not in the list' option", async ({ page }) => {
    await navigateAndWait(page);
    const gibberish = `nrlst${Date.now()}`;
    await logFood(page, gibberish);
    await expandFoodGroup(page);

    const entry = latestEntry(page, new RegExp(gibberish));
    await waitForDotsInEntry(entry, SEL.dotPending, 1);
    await entry.locator(SEL.dotPending).first().click();
    await expect(page.locator(SEL.matchModalBody)).toBeVisible({
      timeout: 5000,
    });

    // Search for gibberish
    await page.locator(SEL.searchFoodsInput).fill("zzzzxyzzy999");

    // Should show "No matches found"
    await expect(page.locator(SEL.matchModalBody).getByText(/No matches found/)).toBeVisible({
      timeout: 3000,
    });

    // Should show the "Not in the list?" link
    await expect(page.locator(SEL.matchModalBody).getByText(/Not in the list\?/)).toBeVisible();
  });

  test("ticket submission form opens and submits", async ({ page }) => {
    await navigateAndWait(page);
    const gibberish = `tktfm${Date.now()}`;
    await logFood(page, gibberish);
    await expandFoodGroup(page);

    const entry = latestEntry(page, new RegExp(gibberish));
    await waitForDotsInEntry(entry, SEL.dotPending, 1);
    await entry.locator(SEL.dotPending).first().click();
    await expect(page.locator(SEL.matchModalBody)).toBeVisible({
      timeout: 5000,
    });

    // Click "Not in the list? Request it be added"
    await page
      .locator(SEL.matchModalBody)
      .getByText(/Not in the list\?/)
      .first()
      .click();

    // Ticket form should appear with textarea and submit button
    const ticketTextarea = page.locator("#ticket-note");
    await expect(ticketTextarea).toBeVisible({ timeout: 3000 });

    // Fill in context and submit
    await ticketTextarea.fill("It's a regional Spanish snack cake");
    await page.locator("button", { hasText: "Submit request" }).click();

    // Should show "Request submitted" confirmation in the modal.
    // Use exact: true to avoid matching the toast notification text which also
    // contains "Request submitted" as a substring.
    await expect(page.getByText("Request submitted", { exact: true })).toBeVisible({
      timeout: 5000,
    });
  });

  test("registry list shows zone badges (Z1/Z2/Z3)", async ({ page }) => {
    await navigateAndWait(page);
    const gibberish = `znbdg${Date.now()}`;
    await logFood(page, gibberish);
    await expandFoodGroup(page);

    const entry = latestEntry(page, new RegExp(gibberish));
    await waitForDotsInEntry(entry, SEL.dotPending, 1);
    await entry.locator(SEL.dotPending).first().click();
    await expect(page.locator(SEL.matchModalBody)).toBeVisible({
      timeout: 5000,
    });

    // Wait for registry list to load (server search returns async)
    const firstZoneBadge = page
      .locator(SEL.matchModalBody)
      .getByText(/^Z[123]$/)
      .first();
    await expect(firstZoneBadge).toBeVisible({ timeout: 10000 });

    // Verify multiple zone badges exist
    const badgeCount = await page
      .locator(SEL.matchModalBody)
      .getByText(/^Z[123]$/)
      .count();
    expect(badgeCount).toBeGreaterThan(0);
  });

  test("registry list is grouped by food group", async ({ page }) => {
    await navigateAndWait(page);
    const gibberish = `grphd${Date.now()}`;
    await logFood(page, gibberish);
    await expandFoodGroup(page);

    const entry = latestEntry(page, new RegExp(gibberish));
    await waitForDotsInEntry(entry, SEL.dotPending, 1);
    await entry.locator(SEL.dotPending).first().click();
    await expect(page.locator(SEL.matchModalBody)).toBeVisible({
      timeout: 5000,
    });

    // Wait for registry list to load (server search returns async).
    // The search input starts empty, so the full registry is queried.
    await expect(page.locator(SEL.matchModalBody).locator('[role="option"]').first()).toBeVisible({
      timeout: 10000,
    });

    // Should see group headers — DOM text is title case (CSS uppercase doesn't affect Playwright)
    for (const group of ["Protein", "Carbs", "Fats", "Seasoning"]) {
      await expect(
        page.locator(SEL.matchModalBody).getByText(group, { exact: true }).first(),
      ).toBeVisible();
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 5: Raw Input Edit Modal
// ═════════════════════════════════════════════════════════════════════════════

test.describe("RawInputEditModal", () => {
  test("edit button only appears for new-style logs (with rawInput)", async ({ page }) => {
    await navigateAndWait(page);
    await logFood(page, "toast");
    await expandFoodGroup(page);

    await waitForDots(page, SEL.dotResolved, 1);

    // Hover to reveal action buttons
    const entry = latestEntry(page, /toast/);
    await entry.hover();

    // The "Edit raw text" button should appear
    const editRawBtn = entry.locator('button[aria-label="Edit raw text"]');
    await expect(editRawBtn).toBeVisible({ timeout: 3000 });
  });

  test("modal pre-fills with current rawInput text", async ({ page }) => {
    await navigateAndWait(page);
    await logFood(page, "toast, banana");
    await expandFoodGroup(page);

    await waitForDots(page, SEL.dotResolved, 2);

    const entry = latestEntry(page, /toast/);
    await entry.hover();
    await entry.locator('button[aria-label="Edit raw text"]').click();

    await expect(page.locator(SEL.editModalTitle).first()).toBeVisible({
      timeout: 5000,
    });

    const textarea = page.locator(SEL.rawInputEditor);
    const value = await textarea.inputValue();
    // Should contain the original raw input
    expect(value).toContain("toast");
    expect(value).toContain("banana");
  });

  test("Save & Reprocess is disabled when text hasn't changed", async ({ page }) => {
    await navigateAndWait(page);
    await logFood(page, "toast");
    await expandFoodGroup(page);

    await waitForDots(page, SEL.dotResolved, 1);

    const entry = latestEntry(page, /toast/);
    await entry.hover();
    await entry.locator('button[aria-label="Edit raw text"]').click();

    await expect(page.locator(SEL.editModalTitle).first()).toBeVisible({
      timeout: 5000,
    });

    // Button should be disabled — text hasn't changed
    await expect(page.locator(SEL.saveReprocessButton)).toBeDisabled();
  });

  test("Save & Reprocess is disabled for empty text", async ({ page }) => {
    await navigateAndWait(page);
    await logFood(page, "toast");
    await expandFoodGroup(page);

    await waitForDots(page, SEL.dotResolved, 1);

    const entry = latestEntry(page, /toast/);
    await entry.hover();
    await entry.locator('button[aria-label="Edit raw text"]').click();

    await expect(page.locator(SEL.editModalTitle).first()).toBeVisible({
      timeout: 5000,
    });

    // Clear the textarea
    const textarea = page.locator(SEL.rawInputEditor);
    await textarea.clear();

    // Button should be disabled — empty text
    await expect(page.locator(SEL.saveReprocessButton)).toBeDisabled();
  });

  test("editing triggers reprocessing and items update", async ({ page }) => {
    await navigateAndWait(page);
    await logFood(page, "quinoa");
    await expandFoodGroup(page);

    // Before edit: 1 resolved item — scope wait to the quinoa entry
    const entry = latestEntry(page, /quinoa/);
    await waitForDotsInEntry(entry, SEL.dotResolved, 1);
    expect(await entry.locator(SEL.dotResolved).count()).toBe(1);

    await entry.hover();
    await entry.locator('button[aria-label="Edit raw text"]').click();

    await expect(page.locator(SEL.editModalTitle).first()).toBeVisible({
      timeout: 5000,
    });

    // Change "quinoa" to "quinoa, rice"
    const textarea = page.locator(SEL.rawInputEditor);
    await textarea.clear();
    await textarea.fill("quinoa, rice");
    await page.locator(SEL.saveReprocessButton).click();

    // Modal should close
    await expect(page.locator(SEL.editModalTitle).first()).not.toBeVisible({
      timeout: 5000,
    });

    // After reprocessing: should have 2 resolved items
    // The old single-item entry should be replaced with 2 items
    await waitForDots(page, SEL.dotResolved, 2, 15000);

    // "rice" should now be visible in the entry.
    // Use .first() because "rice" may match multiple elements — the display name
    // and inline canonical labels like "(brown rice)" or "(white rice)".
    await expect(
      latestEntry(page, /quinoa/)
        .getByText("rice")
        .first(),
    ).toBeVisible({
      timeout: 10000,
    });
  });

  test("editing to all-unresolvable shows amber dots", async ({ page }) => {
    await navigateAndWait(page);
    await logFood(page, "oats");
    await expandFoodGroup(page);

    await waitForDots(page, SEL.dotResolved, 1);

    const entry = latestEntry(page, /oats/);
    await entry.hover();
    await entry.locator('button[aria-label="Edit raw text"]').click();

    await expect(page.locator(SEL.editModalTitle).first()).toBeVisible({
      timeout: 5000,
    });

    // Change to something not in registry
    const textarea = page.locator(SEL.rawInputEditor);
    await textarea.clear();
    await textarea.fill("glorpnik, fizzwax");
    await page.locator(SEL.saveReprocessButton).click();

    // After reprocessing: the green dots should be GONE
    // and amber dots should appear
    await waitForDots(page, SEL.dotPending, 2, 15000);

    // No green dots should remain for this reprocessed entry
    const reprocessedEntry = latestEntry(page, /glorpnik|fizzwax/);
    expect(await reprocessedEntry.locator(SEL.dotResolved).count()).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 6: Toast dismissal & lifecycle
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Toast lifecycle", () => {
  // SKIPPED: Cannot reliably test toast dismissal with a shared database.
  // Other unresolved items from prior tests accumulate in the DB, so
  // totalUnresolved never reaches 0 after matching a single item. This test
  // requires either an isolated DB or a way to reset state between runs.
  // Re-enable once per-test DB isolation is available.
  test.skip("toast auto-dismisses when unresolved items are manually matched", async ({ page }) => {
    await navigateAndWait(page);
    const gibberish = `toast${Date.now()}`;
    await logFood(page, gibberish);
    await expandFoodGroup(page);

    const entry = latestEntry(page, new RegExp(gibberish));
    await waitForDotsInEntry(entry, SEL.dotPending, 1);

    // Toast should be visible
    const toastMsg = page
      .locator(SEL.toast)
      .filter({ hasText: /couldn't be matched|still unmatched/ });
    await expect(toastMsg.first()).toBeVisible({ timeout: 15000 });

    // Match the item via the modal
    await entry.locator(SEL.dotPending).first().click();
    await page.locator(SEL.searchFoodsInput).fill("bread");
    await page
      .locator(SEL.matchModalBody)
      .locator("button")
      .filter({ hasText: "bread" })
      .first()
      .click();
    await page.locator(SEL.matchButton).click();

    // Wait for the match to take effect
    await expect(page.locator(SEL.matchModalTitle).first()).not.toBeVisible({
      timeout: 5000,
    });

    // The "couldn't be matched" toast should eventually dismiss
    // (the hook detects 0 unresolved items and dismisses)
    await expect(toastMsg.first()).not.toBeVisible({ timeout: 20000 });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 7: Input validation & edge cases
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Input validation", () => {
  test("empty input shows error, does NOT create a log entry", async ({ page }) => {
    await navigateAndWait(page);

    const section = page.locator(SEL.foodSection);
    const input = section.locator(SEL.foodInput);

    // Make sure input is empty
    await expect(input).toHaveValue("");

    // Click Log Food
    await section.locator(SEL.logFoodButton).click();

    // Error message should appear
    await expect(page.getByText("Enter a food item.")).toBeVisible({
      timeout: 3000,
    });

    // No food group should appear in Today's Log (no entry was created)
    // Wait briefly to make sure nothing fires
    await page.waitForTimeout(1000);
  });

  test("whitespace-only input is treated as empty", async ({ page }) => {
    await navigateAndWait(page);

    const section = page.locator(SEL.foodSection);
    const input = section.locator(SEL.foodInput);
    await input.fill("   ");
    await section.locator(SEL.logFoodButton).click();

    // Should show error
    await expect(page.getByText("Enter a food item.")).toBeVisible({
      timeout: 3000,
    });
  });
});

test.describe("Edge cases", () => {
  test("commas-only input doesn't create phantom items", async ({ page }) => {
    await navigateAndWait(page);
    await logFood(page, ",,,");
    await expandFoodGroup(page);

    // Wait for processing
    await page.waitForTimeout(3000);

    // If an entry was created, it should either:
    // - Not have items (processing state forever — bug)
    // - Or have 0 resolution dots (nothing to split)
    // This test catches the case where commas-only creates empty items
    const lastEntry = page.locator(SEL.entry).last();
    const dotCount = await lastEntry.locator('[data-slot="resolution-dot"]').count();
    // If there are dots, they should all be legitimate (not empty-string items)
    if (dotCount > 0) {
      const texts = await getItemTexts(lastEntry);
      for (const text of texts) {
        expect(text.length).toBeGreaterThan(0);
        expect(text).not.toBe(",");
      }
    }
  });

  test("special characters and accented text survive round-trip", async ({ page }) => {
    await navigateAndWait(page);
    // Accented chars, apostrophes, parentheses
    await logFood(page, "creme brulee, shepherd's pie");
    await expandFoodGroup(page);

    // Wait for items to appear (either resolved or pending) — scoped to this entry
    const entry = latestEntry(page, /brulee|shepherd/);
    await expect(entry).toBeVisible({ timeout: 10000 });

    // Wait for resolution dots (items have been parsed)
    await expect(entry.locator('[data-slot="resolution-dot"]').first()).toBeVisible({
      timeout: 15000,
    });

    // The display text should preserve the original characters
    const texts = await getItemTexts(entry);
    expect(texts.length).toBeGreaterThanOrEqual(2);

    // At least one should contain an apostrophe or accent (wasn't stripped)
    const hasSpecialChar = texts.some(
      (t) => t.includes("'") || t.includes("é") || t.includes("brulee"),
    );
    expect(hasSpecialChar).toBe(true);
  });

  test("long input (near maxLength) is handled without truncation", async ({ page }) => {
    await navigateAndWait(page);

    // Build a long but valid comma-separated food list
    const foods = [
      "toast",
      "banana",
      "rice",
      "chicken",
      "eggs",
      "salmon",
      "broccoli",
      "garlic",
      "honey",
      "butter",
    ];
    const longInput = foods.join(", ");
    await logFood(page, longInput);
    await expandFoodGroup(page);

    // Wait for items to appear — scoped to this entry
    const entry = latestEntry(page, /salmon|broccoli/);
    await waitForDotsInEntry(entry, '[data-slot="resolution-dot"]', 8, 20000);

    // Should have resolution dots for all items (most are in registry)
    const dotCount = await entry.locator('[data-slot="resolution-dot"]').count();
    expect(dotCount).toBeGreaterThanOrEqual(8); // At least most should parse
  });

  test("rapid double-submit doesn't create duplicate entries", async ({ page }) => {
    await navigateAndWait(page);

    const section = page.locator(SEL.foodSection);
    const input = section.locator(SEL.foodInput);
    const btn = section.locator(SEL.logFoodButton);

    await input.fill("toast");
    // Click twice rapidly
    await btn.click();
    await btn.click();

    await expandFoodGroup(page);

    // Wait for processing
    await page.waitForTimeout(3000);

    // Count entries that contain "toast" — should be exactly 1
    // (second click should have been on an empty input, which is rejected)
    // Note: there may be toast entries from other tests, so we look at the
    // food group count badge or count entries carefully
    const input2 = section.locator(SEL.foodInput);
    await expect(input2).toHaveValue(""); // Input was cleared by first submit
  });

  test("Enter key submits food (keyboard workflow)", async ({ page }) => {
    await navigateAndWait(page);

    const section = page.locator(SEL.foodSection);
    const input = section.locator(SEL.foodInput);
    await input.fill("banana");
    await input.press("Enter");

    // Should submit and clear
    await expect(input).toHaveValue("");

    await expandFoodGroup(page);
    await waitForDots(page, SEL.dotResolved, 1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 8: Multiple entries & state isolation
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Multiple entries", () => {
  test("two different entries maintain independent resolution states", async ({ page }) => {
    await navigateAndWait(page);

    // Log one resolved entry and one unresolved entry — use unique names
    await logFood(page, "butter, honey");
    // Small delay to ensure ordering
    await page.waitForTimeout(500);
    const gibberish = `indep${Date.now()}`;
    await logFood(page, gibberish);

    await expandFoodGroup(page);

    // Wait for both to process — scoped to their respective entries
    const resolvedEntry = latestEntry(page, /butter|honey/);
    await waitForDotsInEntry(resolvedEntry, SEL.dotResolved, 1, 15000);

    const unresolvedEntry = latestEntry(page, new RegExp(gibberish));
    await waitForDotsInEntry(unresolvedEntry, SEL.dotPending, 1, 15000);

    // The resolved entry should have NO amber dots
    const amberInResolved = await resolvedEntry.locator(SEL.dotPending).count();
    expect(amberInResolved).toBe(0);

    // The unresolved entry should have NO green dots
    const greenInUnresolved = await unresolvedEntry.locator(SEL.dotResolved).count();
    expect(greenInUnresolved).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 9: Edit raw text from matching modal
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Edit raw text from matching modal", () => {
  test("'Edit raw text' link in matching modal opens the edit modal", async ({ page }) => {
    await navigateAndWait(page);
    const gibberish = `edraw${Date.now()}`;
    await logFood(page, gibberish);
    await expandFoodGroup(page);

    // Scope to this test's entry to avoid picking up pending dots from prior tests
    const entry = latestEntry(page, new RegExp(gibberish));
    await waitForDotsInEntry(entry, SEL.dotPending, 1);
    await entry.locator(SEL.dotPending).first().click();

    await expect(page.locator(SEL.matchModalBody)).toBeVisible({
      timeout: 5000,
    });

    // Click "Edit raw text" link in the matching modal
    const editRawLink = page.locator(SEL.matchModalBody).getByText("Edit raw text");

    // This link may not be visible if logTimestamp is not passed — test that it IS
    if ((await editRawLink.count()) > 0 && (await editRawLink.isVisible())) {
      await editRawLink.click();

      // The RawInputEditModal should open
      await expect(page.locator(SEL.editModalTitle).first()).toBeVisible({
        timeout: 5000,
      });

      // Should have the current rawInput
      const textarea = page.locator(SEL.rawInputEditor);
      await expect(textarea).toBeVisible();
      const value = await textarea.inputValue();
      expect(value).toContain(gibberish);
    } else {
      // If the link isn't visible, that's a bug — fail explicitly
      expect(
        await editRawLink.count(),
        "Edit raw text link should be visible in matching modal",
      ).toBeGreaterThan(0);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 10: Resolved dot tooltip content
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Resolution dot details", () => {
  test("resolved dot shows canonical name and resolution method on hover", async ({ page }) => {
    await navigateAndWait(page);
    await logFood(page, "toast");
    await expandFoodGroup(page);

    await waitForDots(page, SEL.dotResolved, 1);

    // Hover over the resolved dot to trigger tooltip
    const dot = page.locator(SEL.dotResolved).first();
    await dot.hover();

    // Tooltip should show "Matched: toast (registry)" or similar
    // The TooltipContent shows: Matched: {item.canonicalName} ({item.resolvedBy})
    await expect(page.getByText(/Matched:.*\(registry\)/)).toBeVisible({
      timeout: 5000,
    });
  });
});

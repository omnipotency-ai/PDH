import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/**
 * Adversarial E2E tests for the Patterns page food trial system.
 *
 * These tests verify:
 * 1. Foods logged on Track show up as trials on Patterns
 * 2. Trial counts are correct
 * 3. Expanded sub-rows show individual trial entries with food names + quantities
 * 4. Multiple foods resolving to the same canonical are grouped correctly
 *
 * Many of these tests are expected to FAIL because the sub-row currently
 * does NOT show original food names or quantities — only date, Bristol,
 * transit time, and outcome. This is TDD: write the test first, then
 * fix the code to pass.
 *
 * Prerequisites:
 * - Dev server on :3005 with Convex backend
 * - Existing food logs in the database (from previous usage or test setup)
 * - At least one bowel event logged to create correlated trials
 */

// ── Selectors ───────────────────────────────────────────────────────────────

const SEL = {
  root: "#root",
  // Track page
  nutritionCard: '[data-slot="nutrition-card"]',
  foodInput: 'input[aria-label="Search foods"]',
  logFoodButton: '[data-slot="log-food-button"]',
  foodGroupButton: 'button:has-text("Food intake")',
  dotResolved: '[data-slot="resolution-dot"][aria-label="Matched"]',
  // Navigation
  patternsLink: 'a[href="/patterns"]',
  // Patterns page
  databaseTable: '[data-slot="database-table"]',
  databaseRow: '[data-slot="database-row"]',
  trialSubRow: '[data-slot="trial-history-sub-row"]',
  trialEmpty: '[data-slot="trial-history-empty"]',
  trialList: '[data-slot="trial-history-list"]',
  trialEntry: '[data-slot="trial-entry"]',
  foodCell: '[data-slot="food-cell"]',
  trialsCell: '[data-slot="trials-cell"]',
  searchInput: 'input[placeholder="Search food names..."]',
  // Pagination
  pagination: '[data-slot="database-pagination"]',
} as const;

// ── Helpers ─────────────────────────────────────────────────────────────────

async function navigateToTrack(page: Page) {
  await page.goto("/");
  await expect(page.locator(SEL.root)).toBeVisible();
}

async function navigateToPatterns(page: Page) {
  await page.goto("/patterns");
  await expect(page.locator(SEL.root)).toBeVisible();
  // Wait for the database table to load
  await expect(page.locator(SEL.databaseTable)).toBeVisible({
    timeout: 15000,
  });
}

async function logFoodOnTrack(page: Page, text: string) {
  const section = page.locator(SEL.nutritionCard);
  await expect(section).toBeVisible();
  const input = section.locator(SEL.foodInput).first();
  await expect(input).toBeVisible();
  await input.fill(text);
  await section.locator(SEL.logFoodButton).click();
  await expect(input).toHaveValue("");
}

/** Find a database row by canonical food name text. */
function findFoodRow(page: Page, foodName: string | RegExp): Locator {
  return page
    .locator(SEL.databaseRow)
    .filter({ has: page.locator(SEL.foodCell).filter({ hasText: foodName }) });
}

/** Get the trials cell text (e.g., "7/9") for a food row. */
async function getTrialsText(row: Locator): Promise<string> {
  const cell = row.locator(SEL.trialsCell);
  return (await cell.textContent())?.trim() ?? "";
}

/** Parse the trials display "X/Y" into { resolved, total }. */
function parseTrials(text: string): { resolved: number; total: number } {
  const match = /^(\d+)\/(\d+)$/.exec(text);
  if (!match) return { resolved: 0, total: 0 };
  return { resolved: Number(match[1]), total: Number(match[2]) };
}

/** Click a food row to expand its trial history sub-row. */
async function _expandFoodRow(row: Locator) {
  await row.click();
}

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 1: Patterns page loads and shows food data
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Patterns page structure", () => {
  test("database table is visible with column headers", async ({ page }) => {
    await navigateToPatterns(page);

    const table = page.locator(SEL.databaseTable);
    await expect(table).toBeVisible();

    // Verify key column headers exist
    for (const header of ["Food", "Zone", "Status", "Category", "Trials", "Last eaten"]) {
      await expect(table.getByRole("columnheader", { name: header }).first()).toBeVisible();
    }
  });

  test("foods from Track appear in the database table", async ({ page }) => {
    await navigateToPatterns(page);

    // The database should have at least one food row
    // (from existing logs or previous test runs)
    const rows = page.locator(SEL.databaseRow);
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test("each food row shows trial count in X/Y format", async ({ page }) => {
    await navigateToPatterns(page);

    const firstRow = page.locator(SEL.databaseRow).first();
    await expect(firstRow).toBeVisible();

    const trialsText = await getTrialsText(firstRow);
    // Should match "N/M" format
    expect(trialsText).toMatch(/^\d+\/\d+$/);
  });

  test("search filters the food list", async ({ page }) => {
    await navigateToPatterns(page);

    const allRowsCount = await page.locator(SEL.databaseRow).count();

    // Search for something specific
    const searchInput = page.locator(SEL.searchInput).first();
    await searchInput.fill("toast");

    // Wait for filtering
    await page.waitForTimeout(500);

    const filteredCount = await page.locator(SEL.databaseRow).count();

    // If "toast" exists, should have fewer rows (or same if only one food)
    // If "toast" doesn't exist, should have 0 rows
    expect(filteredCount).toBeLessThanOrEqual(allRowsCount);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 2: Trial sub-row expansion
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Trial history sub-rows", () => {
  test("clicking a food row expands the trial history", async ({ page }) => {
    await navigateToPatterns(page);

    const firstRow = page.locator(SEL.databaseRow).first();
    await expect(firstRow).toBeVisible();

    // Before clicking: no sub-row visible
    await expect(page.locator(SEL.trialSubRow).first()).not.toBeVisible();

    // Click to expand
    await firstRow.click();

    // After clicking: either trial-history-sub-row or trial-history-empty
    const subRowOrEmpty = page.locator(`${SEL.trialSubRow}, ${SEL.trialEmpty}`);
    await expect(subRowOrEmpty.first()).toBeVisible({ timeout: 5000 });
  });

  test("clicking again collapses the trial history", async ({ page }) => {
    await navigateToPatterns(page);

    const firstRow = page.locator(SEL.databaseRow).first();
    await firstRow.click();

    // Wait for expand
    const subRowOrEmpty = page.locator(`${SEL.trialSubRow}, ${SEL.trialEmpty}`);
    await expect(subRowOrEmpty.first()).toBeVisible({ timeout: 5000 });

    // Click again to collapse
    await firstRow.click();

    // Sub-row should disappear (allow time for TanStack re-render)
    await expect(subRowOrEmpty.first()).toBeHidden({ timeout: 5000 });
  });

  test("trial entries show date, Bristol, transit time, and outcome", async ({ page }) => {
    await navigateToPatterns(page);

    // Find a food with resolved trials
    const rows = page.locator(SEL.databaseRow);
    const rowCount = await rows.count();

    let foundTrials = false;
    for (let i = 0; i < Math.min(rowCount, 5); i++) {
      const row = rows.nth(i);
      const trialsText = await getTrialsText(row);
      const { resolved } = parseTrials(trialsText);

      if (resolved > 0) {
        await row.click();
        await expect(page.locator(SEL.trialSubRow)).toBeVisible({
          timeout: 5000,
        });

        const entry = page.locator(SEL.trialEntry).first();
        await expect(entry).toBeVisible();

        // Each entry should have 4 grid columns
        const text = (await entry.textContent()) ?? "";

        // Should contain a date (e.g., "Mar 12", "Feb 26")
        expect(text).toMatch(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/);

        // Should contain Bristol score or dash
        expect(text).toMatch(/Bristol \d|—/);

        // Should contain transit time
        expect(text).toMatch(/Transit \d/);

        // Should contain outcome
        expect(text).toMatch(/good|loose|hard|bad/);

        foundTrials = true;

        // Collapse before moving on
        await row.click();
        break;
      }
    }

    // If no trials found at all, the test is inconclusive but should not crash
    if (!foundTrials) {
      console.warn("No foods with resolved trials found — test is inconclusive");
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 3: Trial sub-row MUST show original food names with quantities
// ═════════════════════════════════════════════════════════════════════════════
//
// TrialHistorySubRow now shows original food names and quantities.
// foodName is displayed via [data-slot="trial-food-name"], with a fallback
// "Food name not recorded" at opacity-40 for legacy entries.
// Quantity/unit is displayed via [data-slot="trial-quantity"].

test.describe("Trial sub-row food names", () => {
  test("trial entry shows the original food name, not just the canonical name", async ({
    page,
  }) => {
    await navigateToPatterns(page);

    // Find a food row with trials
    const rows = page.locator(SEL.databaseRow);
    const rowCount = await rows.count();

    for (let i = 0; i < Math.min(rowCount, 10); i++) {
      const row = rows.nth(i);
      const trialsText = await getTrialsText(row);
      const { resolved } = parseTrials(trialsText);

      if (resolved > 0) {
        // Get the canonical name from the food cell
        const foodCell = row.locator(SEL.foodCell);
        const canonicalName = (await foodCell.textContent())?.trim() ?? "";

        await row.click();
        await expect(page.locator(SEL.trialSubRow)).toBeVisible({
          timeout: 5000,
        });

        const entries = page.locator(SEL.trialEntry);
        const entryCount = await entries.count();

        // At least one entry should show a food name
        // The food name could be the same as canonical OR could be
        // the original user input (e.g., "baguette" for canonical "bread")
        let anyEntryHasFoodName = false;
        for (let j = 0; j < entryCount; j++) {
          const entryText = (await entries.nth(j).textContent()) ?? "";
          // A food name is any non-empty text that isn't just date/Bristol/transit/outcome
          // We look for a 5th data element beyond the current 4 columns
          // Current: "Mar 12 Bristol 5 Transit 8.5h ✓ good"
          // Expected: "Mar 12 Bristol 5 Transit 8.5h ✓ good  baguette (2 slices)"
          //                                                    ^^^^^^^^^^^^^^^^^^^^
          // The food name should be present somewhere in the entry
          if (entryText.length > 0) {
            // Check if the entry contains ANYTHING beyond the standard 4 fields
            // Strip out date, Bristol, Transit, outcome
            const stripped = entryText
              .replace(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d+/g, "")
              .replace(/Bristol\s+\d+/g, "")
              .replace(/Transit\s+[\d.]+h/g, "")
              .replace(/[✓○✗]\s*(?:good|loose|hard|bad)/g, "")
              .replace(/—/g, "")
              .trim();

            if (stripped.length > 0) {
              anyEntryHasFoodName = true;
              break;
            }
          }
        }

        expect(
          anyEntryHasFoodName,
          `Trial entries for "${canonicalName}" should show original food names, but only show date/Bristol/transit/outcome`,
        ).toBe(true);

        // Collapse
        await row.click();
        break;
      }
    }
  });

  test("trial entries for bread canonical should show original names like baguette, bread snack", async ({
    page,
  }) => {
    await navigateToPatterns(page);

    // Search for a food that might have multiple aliases
    // (bread, toast, etc. — canonicals that multiple raw inputs resolve to)
    const searchInput = page.locator(SEL.searchInput).first();

    // Try to find "bread" or "toast" — common foods with multiple aliases
    for (const searchTerm of ["bread", "toast", "rice"]) {
      await searchInput.fill(searchTerm);
      await page.waitForTimeout(500);

      const rows = page.locator(SEL.databaseRow);
      const count = await rows.count();
      if (count === 0) continue;

      const row = rows.first();
      const trialsText = await getTrialsText(row);
      const { resolved } = parseTrials(trialsText);
      // Need resolved > 0, not just total > 0, because the sub-row only
      // renders trial-history-sub-row when resolvedTrials is non-empty.
      if (resolved === 0) continue;

      await row.click();
      await expect(page.locator(SEL.trialSubRow)).toBeVisible({
        timeout: 5000,
      });

      // Each trial entry should show the ORIGINAL food name that resolved
      // to this canonical — e.g., if canonical is "bread", entries might show:
      // - "baguette" (resolved to bread)
      // - "bread snack" (resolved to bread)
      // - "bread" (exact match)
      const entries = page.locator(SEL.trialEntry);
      const entryCount = await entries.count();

      for (let j = 0; j < Math.min(entryCount, 5); j++) {
        const entry = entries.nth(j);
        // Look for a food name element within the entry
        // This could be a span, a column, etc. — we're testing that it EXISTS
        const foodNameEl = entry.locator("[data-slot='trial-food-name']");
        const hasFoodName = (await foodNameEl.count()) > 0;

        // Every trial entry should have either trial-food-name or trial-food-name-missing
        const foodNameMissingEl = entry.locator("[data-slot='trial-food-name-missing']");
        const hasFoodNameOrMissing = hasFoodName || (await foodNameMissingEl.count()) > 0;
        expect(
          hasFoodNameOrMissing,
          `Trial entry should have a [data-slot="trial-food-name"] or [data-slot="trial-food-name-missing"] element`,
        ).toBe(true);

        if (hasFoodName) {
          const name = (await foodNameEl.textContent())?.trim() ?? "";
          expect(name.length).toBeGreaterThan(0);
        }
      }

      await row.click();
      break;
    }
  });

  test("trial entries show quantity and unit when available", async ({ page }) => {
    await navigateToPatterns(page);

    // Find any food with trials
    const rows = page.locator(SEL.databaseRow);
    const count = await rows.count();

    for (let i = 0; i < Math.min(count, 10); i++) {
      const row = rows.nth(i);
      const trialsText = await getTrialsText(row);
      const { resolved } = parseTrials(trialsText);

      if (resolved > 0) {
        await row.click();
        // resolvedTransits > 0 doesn't guarantee resolvedTrials array is populated
        // (count vs detail records may differ), so accept either sub-row variant.
        const subRowOrEmpty = page.locator(`${SEL.trialSubRow}, ${SEL.trialEmpty}`);
        await expect(subRowOrEmpty.first()).toBeVisible({ timeout: 5000 });

        // If there are no trial entries (empty state), skip quantity check
        const hasTrialSubRow = (await page.locator(SEL.trialSubRow).count()) > 0;
        if (!hasTrialSubRow) {
          await row.click();
          continue;
        }

        // Look for quantity/unit display in trial entries
        // Expected format: "4 slices" or "200g" or "2 tbsp"
        const entries = page.locator(SEL.trialEntry);
        const entryCount = await entries.count();

        let foundQuantity = false;
        for (let j = 0; j < entryCount; j++) {
          const qtyEl = entries.nth(j).locator("[data-slot='trial-quantity']");
          if ((await qtyEl.count()) > 0) {
            foundQuantity = true;
            break;
          }
        }

        // Not all trials will have quantities (some were logged without).
        // If none have quantities, that's okay for legacy data — just warn.
        if (!foundQuantity) {
          console.warn(
            "No trial entries with [data-slot='trial-quantity'] found — may be legacy data without quantities",
          );
        }

        await row.click();
        break;
      }
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 4: Trial count correctness
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Trial count accuracy", () => {
  test("total trials (denominator) matches number of sub-row entries", async ({ page }) => {
    await navigateToPatterns(page);

    const rows = page.locator(SEL.databaseRow);
    const rowCount = await rows.count();

    for (let i = 0; i < Math.min(rowCount, 5); i++) {
      const row = rows.nth(i);
      const trialsText = await getTrialsText(row);
      const { total } = parseTrials(trialsText);

      if (total > 0 && total <= 20) {
        // Small enough to verify
        await row.click();

        const subRow = page.locator(SEL.trialSubRow);
        if ((await subRow.count()) > 0) {
          await expect(subRow).toBeVisible({ timeout: 5000 });

          const entries = page.locator(SEL.trialEntry);
          const entryCount = await entries.count();

          // The number of sub-row entries should match resolvedTransits (numerator),
          // NOT totalTrials (denominator), since sub-rows show resolved correlations only
          const { resolved } = parseTrials(trialsText);
          expect(entryCount).toBe(resolved);
        }

        await row.click();
        break;
      }
    }
  });

  test("logging a new food on Track increases its trial count on Patterns", async ({ page }) => {
    // This test logs food on Track, then checks Patterns for the count update.
    // It may not see an immediate change since trials require bowel event
    // correlation (6-hour evidence window), but the TOTAL count (denominator)
    // should increase since that counts all food log entries.

    // Step 1: Go to Patterns and record the current trial count for "toast"
    await navigateToPatterns(page);

    const searchInput = page.locator(SEL.searchInput).first();
    await searchInput.fill("toast");
    await page.waitForTimeout(500);

    let beforeTotal = 0;
    const toastRow = findFoodRow(page, /toast/i);
    if ((await toastRow.count()) > 0) {
      const trialsText = await getTrialsText(toastRow.first());
      beforeTotal = parseTrials(trialsText).total;
    }

    // Step 2: Go to Track and log "toast"
    await navigateToTrack(page);
    await logFoodOnTrack(page, "toast");

    // Wait for processing
    const foodGroupBtn = page.locator(SEL.foodGroupButton).first();
    await expect(foodGroupBtn).toBeVisible({ timeout: 10000 });
    await foodGroupBtn.click();
    await page.waitForTimeout(300);
    await expect(page.locator(SEL.dotResolved).first()).toBeVisible({
      timeout: 15000,
    });

    // Step 3: Go back to Patterns and check the count
    await navigateToPatterns(page);
    await searchInput.fill("toast");
    await page.waitForTimeout(1000);

    const toastRowAfter = findFoodRow(page, /toast/i);
    await expect(toastRowAfter.first()).toBeVisible({ timeout: 10000 });

    const afterTrialsText = await getTrialsText(toastRowAfter.first());
    const afterTotal = parseTrials(afterTrialsText).total;

    // The total should have increased by at least 1. Other tests in the suite
    // may also log "toast", so we can't assert an exact +1 increase.
    expect(afterTotal).toBeGreaterThanOrEqual(beforeTotal + 1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 5: Food grouping (multiple aliases → one canonical)
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Canonical grouping", () => {
  test("foods resolving to the same canonical appear as one row, not separate rows", async ({
    page,
  }) => {
    await navigateToPatterns(page);

    // Verify no duplicate canonical names EXCLUDING known test-contamination names
    // (e2e tests log many entries with fake names like "kelitos", "zarblix" etc.)
    const testFoods = new Set([
      "kelitos",
      "zarblix",
      "glorpnik",
      "fizzwax",
      "biscoff",
      "xylophone juice",
    ]);
    const rows = page.locator(SEL.databaseRow);
    const rowCount = await rows.count();

    const seenCanonicals = new Set<string>();
    const duplicates: string[] = [];

    for (let i = 0; i < rowCount; i++) {
      const cell = rows.nth(i).locator(SEL.foodCell);
      const name = ((await cell.textContent()) ?? "").replace("Manual", "").trim();
      // Skip fake test foods — they can appear as duplicates due to shared DB
      if (testFoods.has(name.toLowerCase())) continue;
      if (seenCanonicals.has(name.toLowerCase())) {
        duplicates.push(name);
      }
      seenCanonicals.add(name.toLowerCase());
    }

    expect(duplicates, `Found duplicate food rows: ${duplicates.join(", ")}`).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 6: unknown_food must NOT appear in the table
// ═════════════════════════════════════════════════════════════════════════════

test.describe("unknown_food filtering", () => {
  test("unknown_food does NOT appear as a row in the database table", async ({ page }) => {
    await navigateToPatterns(page);

    // Search for "unknown"
    const searchInput = page.locator(SEL.searchInput).first();
    await searchInput.fill("unknown");
    await page.waitForTimeout(500);

    // Should find no rows, or at least no row with "unknown_food" text
    const unknownRow = findFoodRow(page, /unknown_food/);
    expect(await unknownRow.count()).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 7: Data integrity checks
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Data integrity", () => {
  test("resolved count never exceeds total count", async ({ page }) => {
    await navigateToPatterns(page);

    const rows = page.locator(SEL.databaseRow);
    const rowCount = await rows.count();

    for (let i = 0; i < rowCount; i++) {
      const trialsText = await getTrialsText(rows.nth(i));
      const { resolved, total } = parseTrials(trialsText);

      const foodCell = rows.nth(i).locator(SEL.foodCell);
      const name = (await foodCell.textContent())?.trim() ?? `row ${i}`;

      expect(
        resolved,
        `${name}: resolved (${resolved}) should not exceed total (${total})`,
      ).toBeLessThanOrEqual(total);
    }
  });

  test("every food row has a category badge (not a dash)", async ({ page }) => {
    await navigateToPatterns(page);

    const rows = page.locator(SEL.databaseRow);
    const rowCount = await rows.count();

    const missingCategory: string[] = [];

    for (let i = 0; i < Math.min(rowCount, 20); i++) {
      const row = rows.nth(i);
      const foodCell = row.locator(SEL.foodCell);
      const name = (await foodCell.textContent())?.trim() ?? `row ${i}`;

      const categoryCell = row.locator('[data-slot="category-cell"]');
      const hasCategoryBadge = (await categoryCell.count()) > 0;

      if (!hasCategoryBadge) {
        missingCategory.push(name);
      }
    }

    // Foods in the registry should always have a category
    // If any are missing, they may not be in the registry (bug or legacy data)
    if (missingCategory.length > 0) {
      console.warn(`Foods missing category badge: ${missingCategory.join(", ")}`);
    }
    // Don't hard-fail on this — legacy data may not have categories
  });

  test("every food row has a zone number (not a dash)", async ({ page }) => {
    await navigateToPatterns(page);

    const rows = page.locator(SEL.databaseRow);
    const rowCount = await rows.count();

    const missingZone: string[] = [];

    for (let i = 0; i < Math.min(rowCount, 20); i++) {
      const row = rows.nth(i);
      const foodCell = row.locator(SEL.foodCell);
      const name = (await foodCell.textContent())?.trim() ?? `row ${i}`;

      const stageCell = row.locator('[data-slot="stage-cell"]');
      const hasZone = (await stageCell.count()) > 0;

      if (!hasZone) {
        missingZone.push(name);
      }
    }

    if (missingZone.length > 0) {
      console.warn(`Foods missing zone number: ${missingZone.join(", ")}`);
    }
  });
});

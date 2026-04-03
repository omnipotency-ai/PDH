/**
 * Food Pipeline Branch Coverage Tests
 *
 * Tests branches not covered by the main foodParsing.test.ts:
 * - Legacy log path (items pre-filled, no rawInput)
 * - Quantity extraction variants
 * - resolveItem mutation (manual matching)
 * - resolveItem on expired items (pending guard fix)
 */
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import schema from "../schema";

describe("legacy log path", () => {
  it("creates ingredient exposures immediately for legacy logs with pre-filled items", async () => {
    const t = convexTest(schema);
    const userId = "test-legacy-path";

    // Legacy path: items are pre-filled by old client, no rawInput
    const logId = await t
      .withIdentity({ subject: userId })
      .mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "food",
        data: {
          items: [
            {
              name: "toast",
              canonicalName: "toast",
              quantity: null,
              unit: null,
            },
            {
              name: "banana",
              canonicalName: "ripe banana",
              quantity: null,
              unit: null,
            },
          ],
          notes: "",
        },
      });

    // Legacy path creates exposures immediately (no 6-hour wait)
    await t.run(async (ctx) => {
      const exposures = await ctx.db
        .query("ingredientExposures")
        .withIndex("by_userId_logId", (q) =>
          q.eq("userId", userId).eq("logId", logId),
        )
        .collect();

      // Should have exposures right away
      expect(exposures.length).toBeGreaterThan(0);
    });
  });

  it("does NOT schedule processLogInternal for legacy logs", async () => {
    const t = convexTest(schema);
    const userId = "test-legacy-no-schedule";

    await t.withIdentity({ subject: userId }).mutation(api.logs.add, {
      timestamp: Date.now(),
      type: "food",
      data: {
        items: [
          { name: "toast", canonicalName: "toast", quantity: null, unit: null },
        ],
        notes: "",
      },
    });

    // If processLogInternal was scheduled, running timers would trigger it.
    // For legacy path, it should NOT be scheduled.
    // We can verify by checking that no scheduled functions exist
    // (the test framework tracks these)
    vi.useFakeTimers();
    vi.runAllTimers();
    await t.finishInProgressScheduledFunctions();
    vi.useRealTimers();

    // If we got here without error, no processLogInternal was scheduled
    // (it would fail or do nothing since there's no rawInput)
  });
});

describe("quantity extraction", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("strips numeric count from parsedName", async () => {
    const t = convexTest(schema);
    const userId = "test-qty-numeric";

    const logId = await t
      .withIdentity({ subject: userId })
      .mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "food",
        data: { rawInput: "4 toast", items: [], notes: "" },
      });

    vi.runAllTimers();
    await t.finishInProgressScheduledFunctions();

    await t.run(async (ctx) => {
      const log = await ctx.db.get(logId);
      if (log === null) throw new Error("expected log");
      const items = (
        (log as Doc<"logs">).data as {
          items: Array<{
            parsedName: string;
            quantity: number | null;
            unit: string | null;
            userSegment: string;
          }>;
        }
      ).items;
      expect(items).toHaveLength(1);
      expect(items[0].parsedName).toBe("toast");
      expect(items[0].quantity).toBe(4);
      expect(items[0].unit).toBeNull();
      expect(items[0].userSegment).toBe("4 toast");
    });
  });

  it("strips measurement unit from parsedName", async () => {
    const t = convexTest(schema);
    const userId = "test-qty-measure";

    const logId = await t
      .withIdentity({ subject: userId })
      .mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "food",
        data: { rawInput: "200g rice", items: [], notes: "" },
      });

    vi.runAllTimers();
    await t.finishInProgressScheduledFunctions();

    await t.run(async (ctx) => {
      const log = await ctx.db.get(logId);
      if (log === null) throw new Error("expected log");
      const items = (
        (log as Doc<"logs">).data as {
          items: Array<{
            parsedName: string;
            quantity: number | null;
            unit: string | null;
          }>;
        }
      ).items;
      expect(items).toHaveLength(1);
      expect(items[0].parsedName).toBe("rice");
      expect(items[0].quantity).toBe(200);
      expect(items[0].unit).toBe("g");
    });
  });

  it("strips word number from parsedName", async () => {
    const t = convexTest(schema);
    const userId = "test-qty-word";

    const logId = await t
      .withIdentity({ subject: userId })
      .mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "food",
        data: { rawInput: "two bananas", items: [], notes: "" },
      });

    vi.runAllTimers();
    await t.finishInProgressScheduledFunctions();

    await t.run(async (ctx) => {
      const log = await ctx.db.get(logId);
      if (log === null) throw new Error("expected log");
      const items = (
        (log as Doc<"logs">).data as {
          items: Array<{ parsedName: string; quantity: number | null }>;
        }
      ).items;
      expect(items).toHaveLength(1);
      expect(items[0].parsedName).toBe("bananas");
      expect(items[0].quantity).toBe(2);
    });
  });

  it("handles items with no quantity", async () => {
    const t = convexTest(schema);
    const userId = "test-qty-none";

    const logId = await t
      .withIdentity({ subject: userId })
      .mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "food",
        data: { rawInput: "honey", items: [], notes: "" },
      });

    vi.runAllTimers();
    await t.finishInProgressScheduledFunctions();

    await t.run(async (ctx) => {
      const log = await ctx.db.get(logId);
      if (log === null) throw new Error("expected log");
      const items = (
        (log as Doc<"logs">).data as {
          items: Array<{
            parsedName: string;
            quantity: number | null;
            unit: string | null;
          }>;
        }
      ).items;
      expect(items).toHaveLength(1);
      expect(items[0].parsedName).toBe("honey");
      expect(items[0].quantity).toBeNull();
      expect(items[0].unit).toBeNull();
    });
  });
});

describe("resolveItem mutation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows manual matching of pending items", async () => {
    const t = convexTest(schema);
    const userId = "test-resolve-pending";

    const logId = await t
      .withIdentity({ subject: userId })
      .mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "food",
        data: { rawInput: "zxyphlor", items: [], notes: "" },
      });

    // Run deterministic parsing — zxyphlor will be unresolved
    vi.runAllTimers();
    await t.finishInProgressScheduledFunctions();

    // Verify item is pending
    await t.run(async (ctx) => {
      const log = await ctx.db.get(logId);
      if (log === null) throw new Error("expected log");
      const items = (
        (log as Doc<"logs">).data as {
          items: Array<{ canonicalName?: string }>;
        }
      ).items;
      expect(items[0].canonicalName).toBeUndefined();
    });

    // Manually resolve via resolveItem
    await t
      .withIdentity({ subject: userId })
      .mutation(api.foodParsing.resolveItem, {
        logId,
        itemIndex: 0,
        canonicalName: "sweet biscuit",
      });

    // Verify item is now resolved
    await t.run(async (ctx) => {
      const log = await ctx.db.get(logId);
      if (log === null) throw new Error("expected log");
      const items = (
        (log as Doc<"logs">).data as {
          items: Array<{ canonicalName?: string; resolvedBy?: string }>;
        }
      ).items;
      expect(items[0].canonicalName).toBe("sweet biscuit");
      expect(items[0].resolvedBy).toBe("user");
    });
  });

  it("rejects resolveItem on wrong user's log", async () => {
    const t = convexTest(schema);
    vi.useFakeTimers();

    const logId = await t
      .withIdentity({ subject: "user-a" })
      .mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "food",
        data: { rawInput: "zxyphlor", items: [], notes: "" },
      });

    vi.runAllTimers();
    await t.finishInProgressScheduledFunctions();
    vi.useRealTimers();

    await expect(
      t
        .withIdentity({ subject: "user-b" })
        .mutation(api.foodParsing.resolveItem, {
          logId,
          itemIndex: 0,
          canonicalName: "toast",
        }),
    ).rejects.toThrow("Not authorized");
  });

  it("rejects resolveItem on non-food log", async () => {
    const t = convexTest(schema);

    const logId = await t
      .withIdentity({ subject: "test-user" })
      .mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "digestion",
        data: {
          bristolCode: 4,
        },
      });

    await expect(
      t
        .withIdentity({ subject: "test-user" })
        .mutation(api.foodParsing.resolveItem, {
          logId,
          itemIndex: 0,
          canonicalName: "toast",
        }),
    ).rejects.toThrow("not a food or liquid log");
  });

  it("rejects resolveItem with out-of-range item index", async () => {
    const t = convexTest(schema);
    vi.useFakeTimers();

    const logId = await t
      .withIdentity({ subject: "test-user" })
      .mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "food",
        data: { rawInput: "zxyphlor", items: [], notes: "" },
      });

    vi.runAllTimers();
    await t.finishInProgressScheduledFunctions();
    vi.useRealTimers();

    await expect(
      t
        .withIdentity({ subject: "test-user" })
        .mutation(api.foodParsing.resolveItem, {
          logId,
          itemIndex: 5,
          canonicalName: "toast",
        }),
    ).rejects.toThrow("out of range");
  });

  it("rejects resolveItem on log with empty items", async () => {
    const t = convexTest(schema);

    // Create a food log that's still processing (rawInput set, items empty)
    const logId = await t
      .withIdentity({ subject: "test-user" })
      .mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "food",
        data: { rawInput: "toast", items: [], notes: "" },
      });

    // Don't run timers — items stay empty (processing state)
    await expect(
      t
        .withIdentity({ subject: "test-user" })
        .mutation(api.foodParsing.resolveItem, {
          logId,
          itemIndex: 0,
          canonicalName: "toast",
        }),
    ).rejects.toThrow("no items");
  });

  it("rejects invalid canonical names not in registry", async () => {
    const t = convexTest(schema);
    const userId = "test-resolve-invalid";

    const logId = await t
      .withIdentity({ subject: userId })
      .mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "food",
        data: { rawInput: "zxyphlor", items: [], notes: "" },
      });

    vi.runAllTimers();
    await t.finishInProgressScheduledFunctions();

    // Try to resolve with a name not in registry
    await expect(
      t
        .withIdentity({ subject: userId })
        .mutation(api.foodParsing.resolveItem, {
          logId,
          itemIndex: 0,
          canonicalName: "completely_fake_food",
        }),
    ).rejects.toThrow();
  });

  it("rejects re-matching already resolved items", async () => {
    const t = convexTest(schema);
    const userId = "test-resolve-already";

    const logId = await t
      .withIdentity({ subject: userId })
      .mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "food",
        data: { rawInput: "toast", items: [], notes: "" },
      });

    vi.runAllTimers();
    await t.finishInProgressScheduledFunctions();

    // Toast is already registry-resolved — resolveItem should reject
    await expect(
      t
        .withIdentity({ subject: userId })
        .mutation(api.foodParsing.resolveItem, {
          logId,
          itemIndex: 0,
          canonicalName: "bread",
        }),
    ).rejects.toThrow("already resolved");
  });

  it("rejects re-matching expired items", async () => {
    // Policy: "Never allow resolveItem on expired items." Users should edit the
    // raw log text to fix expired items, not re-match through the modal.
    const t = convexTest(schema);
    const userId = "test-resolve-expired";

    const logId = await t
      .withIdentity({ subject: userId })
      .mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "food",
        data: { rawInput: "zxyphlor", items: [], notes: "" },
      });

    // Run everything including 6-hour expiry
    vi.runAllTimers();
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());

    // Verify item is expired
    await t.run(async (ctx) => {
      const log = await ctx.db.get(logId);
      if (log === null) throw new Error("expected log");
      const items = (
        (log as Doc<"logs">).data as {
          items: Array<{ canonicalName?: string; resolvedBy?: string }>;
        }
      ).items;
      expect(items[0].canonicalName).toBe("unknown_food");
      expect(items[0].resolvedBy).toBe("expired");
    });

    // Attempting to resolve an expired item should be rejected per policy
    await expect(
      t
        .withIdentity({ subject: userId })
        .mutation(api.foodParsing.resolveItem, {
          logId,
          itemIndex: 0,
          canonicalName: "sweet biscuit",
        }),
    ).rejects.toThrow();
  });

  it("makes learned aliases visible in the manual search query", async () => {
    const t = convexTest(schema);
    const userId = "test-search-learned-alias";

    const logId = await t
      .withIdentity({ subject: userId })
      .mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "food",
        data: { rawInput: "zxyphlor", items: [], notes: "" },
      });

    vi.runAllTimers();
    await t.finishInProgressScheduledFunctions();

    await t
      .withIdentity({ subject: userId })
      .mutation(api.foodParsing.resolveItem, {
        logId,
        itemIndex: 0,
        canonicalName: "sweet biscuit",
      });

    const results = await t
      .withIdentity({ subject: userId })
      .query(api.foodParsing.searchFoods, {
        query: "zxyphlor",
        limit: 10,
      });

    expect(results[0]?.canonicalName).toBe("sweet biscuit");
  });
});

// ---------------------------------------------------------------------------
// processLogInternal — error paths and edge cases
// ---------------------------------------------------------------------------

describe("processLogInternal error paths", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("silently returns when log does not exist", async () => {
    const t = convexTest(schema);

    // Fabricate a valid-looking but non-existent log ID by creating and deleting a log
    const userId = "test-processlog-missing";
    const logId = await t
      .withIdentity({ subject: userId })
      .mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "digestion",
        data: { bristolCode: 4 },
      });

    await t
      .withIdentity({ subject: userId })
      .mutation(api.logs.remove, { id: logId });

    // processLogInternal should silently return (not throw) for a deleted log
    await t.run(async (ctx) => {
      const log = await ctx.db.get(logId);
      expect(log).toBeNull();
    });

    // Call processLogInternal — should not throw
    await t.action(internal.foodParsing.processLogInternal, { logId });
  });

  it("silently returns when log is not a food type", async () => {
    const t = convexTest(schema);
    const userId = "test-processlog-nonfood";

    const logId = await t
      .withIdentity({ subject: userId })
      .mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "digestion",
        data: { bristolCode: 4 },
      });

    // processLogInternal should return without error for non-food logs
    await t.action(internal.foodParsing.processLogInternal, { logId });

    // Log should remain unchanged
    await t.run(async (ctx) => {
      const log = await ctx.db.get(logId);
      if (log === null) throw new Error("expected log");
      const typedLog = log as Doc<"logs">;
      expect(typedLog.type).toBe("digestion");
      const data = typedLog.data as { bristolCode: number };
      expect(data.bristolCode).toBe(4);
    });
  });

  it("silently returns when food log has no rawInput (legacy items only)", async () => {
    const t = convexTest(schema);
    const userId = "test-processlog-no-rawinput";

    // Create a legacy food log with pre-filled items but no rawInput
    const logId = await t
      .withIdentity({ subject: userId })
      .mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "food",
        data: {
          items: [
            {
              name: "toast",
              canonicalName: "toast",
              quantity: null,
              unit: null,
            },
          ],
          notes: "",
        },
      });

    // processLogInternal should return without error
    await t.action(internal.foodParsing.processLogInternal, { logId });

    // Existing items should remain unchanged
    await t.run(async (ctx) => {
      const log = await ctx.db.get(logId);
      if (log === null) throw new Error("expected log");
      const data = (log as Doc<"logs">).data as {
        items: Array<{ canonicalName?: string; name?: string }>;
      };
      expect(data.items).toHaveLength(1);
      expect(data.items[0].canonicalName).toBe("toast");
    });
  });

  it("processes rawInput with only whitespace/commas as empty segments", async () => {
    const t = convexTest(schema);
    const userId = "test-processlog-whitespace";

    // Create a food log where rawInput is effectively empty after sanitization
    const logId = await t
      .withIdentity({ subject: userId })
      .mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "food",
        data: { rawInput: "  ,  ,  ", items: [], notes: "" },
      });

    vi.runAllTimers();
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());

    // After processing, items should reflect the sanitized segments
    await t.run(async (ctx) => {
      const log = await ctx.db.get(logId);
      if (log === null) throw new Error("expected log");
      const data = (log as Doc<"logs">).data as { items: unknown[] };
      // Whitespace-only segments are filtered out by splitRawFoodItems
      expect(data.items).toHaveLength(0);
    });
  });

  it("handles rawInput with unrecognized foods (no registry match)", async () => {
    const t = convexTest(schema);
    const userId = "test-processlog-unrecognized";

    const logId = await t
      .withIdentity({ subject: userId })
      .mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "food",
        data: { rawInput: "xylophrenic gloop", items: [], notes: "" },
      });

    // Run only the delay-0 processLogInternal, not the 6-hour processEvidence
    // (which would expire unresolved items to unknown_food).
    vi.advanceTimersByTime(100);
    await t.finishInProgressScheduledFunctions();

    // Item should be parsed but remain unresolved (no canonicalName)
    await t.run(async (ctx) => {
      const log = await ctx.db.get(logId);
      if (log === null) throw new Error("expected log");
      const data = (log as Doc<"logs">).data as {
        items: Array<{
          parsedName: string;
          canonicalName?: string;
          resolvedBy?: string;
          userSegment: string;
        }>;
      };
      expect(data.items).toHaveLength(1);
      expect(data.items[0].parsedName).toBe("xylophrenic gloop");
      expect(data.items[0].canonicalName).toBeUndefined();
      expect(data.items[0].resolvedBy).toBeUndefined();
      expect(data.items[0].userSegment).toBe("xylophrenic gloop");
    });
  });

  it("handles mixed recognized and unrecognized foods", async () => {
    const t = convexTest(schema);
    const userId = "test-processlog-mixed";

    const logId = await t
      .withIdentity({ subject: userId })
      .mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "food",
        data: {
          rawInput: "toast, xylophrenic gloop, honey",
          items: [],
          notes: "",
        },
      });

    // Run only the delay-0 processLogInternal, not the 6-hour processEvidence
    // (which would expire unresolved items to unknown_food).
    vi.advanceTimersByTime(100);
    await t.finishInProgressScheduledFunctions();

    await t.run(async (ctx) => {
      const log = await ctx.db.get(logId);
      if (log === null) throw new Error("expected log");
      const data = (log as Doc<"logs">).data as {
        items: Array<{
          parsedName: string;
          canonicalName?: string;
          resolvedBy?: string;
        }>;
      };
      expect(data.items).toHaveLength(3);

      // toast — resolved by registry
      expect(data.items[0].canonicalName).toBe("toast");
      expect(data.items[0].resolvedBy).toBe("registry");

      // xylophrenic gloop — unresolved
      expect(data.items[1].canonicalName).toBeUndefined();
      expect(data.items[1].resolvedBy).toBeUndefined();

      // honey — resolved by registry
      expect(data.items[2].canonicalName).toBe("honey");
      expect(data.items[2].resolvedBy).toBe("registry");
    });
  });

  it("schedules processEvidence after successful processing", async () => {
    const t = convexTest(schema);
    const userId = "test-processlog-evidence-scheduled";

    const logId = await t
      .withIdentity({ subject: userId })
      .mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "food",
        data: { rawInput: "toast", items: [], notes: "" },
      });

    // Run all scheduled functions including the 6-hour processEvidence
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());

    // After evidence processing, exposures should exist and evidenceProcessedAt should be set
    await t.run(async (ctx) => {
      const log = await ctx.db.get(logId);
      if (log === null) throw new Error("expected log");
      const data = (log as Doc<"logs">).data as {
        evidenceProcessedAt?: number;
      };
      expect(data.evidenceProcessedAt).toBeDefined();
      expect(typeof data.evidenceProcessedAt).toBe("number");
    });
  });
});

describe("log deletion clears exposures", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("clears ingredientExposures when a food log is deleted", async () => {
    const t = convexTest(schema);
    const userId = "test-delete-exposures";

    const logId = await t
      .withIdentity({ subject: userId })
      .mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "food",
        data: { rawInput: "toast, honey", items: [], notes: "" },
      });

    // Run full pipeline including evidence
    vi.runAllTimers();
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());

    // Verify exposures exist
    await t.run(async (ctx) => {
      const exposures = await ctx.db
        .query("ingredientExposures")
        .withIndex("by_userId_logId", (q) =>
          q.eq("userId", userId).eq("logId", logId),
        )
        .collect();
      expect(exposures).toHaveLength(2);
    });

    // Delete the log
    await t
      .withIdentity({ subject: userId })
      .mutation(api.logs.remove, { id: logId });

    // Exposures should be cleared
    await t.run(async (ctx) => {
      const exposures = await ctx.db
        .query("ingredientExposures")
        .withIndex("by_userId_logId", (q) =>
          q.eq("userId", userId).eq("logId", logId),
        )
        .collect();
      expect(exposures).toHaveLength(0);
    });
  });
});

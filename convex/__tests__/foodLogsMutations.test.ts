/**
 * Food Logs Mutations — Coverage Tests
 *
 * Exercises the `add`, `update`, `remove`, `list`, and `listByRange` functions
 * from convex/logs.ts with focus on the food-related mutation branches:
 *
 * - add: rawInput + empty items (schedules processLogInternal)
 * - add: pre-filled items / legacy (calls rebuildIngredientExposuresForFoodLog)
 * - add: non-food log types
 * - add: auth enforcement
 * - update: food log with rawInput (clears exposures, schedules processLogInternal)
 * - update: food log without rawInput / legacy (rebuilds exposures immediately)
 * - update: non-food log
 * - update: auth + ownership
 * - remove: food log (clears exposures)
 * - remove: non-food log
 * - remove: auth + ownership
 * - list / listByRange: basic retrieval, auth, scoping
 */
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import schema from "../schema";

// ---------------------------------------------------------------------------
// add mutation
// ---------------------------------------------------------------------------

describe("logs.add", () => {
  it("rejects unauthenticated access", async () => {
    const t = convexTest(schema);
    await expect(
      t.mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "food",
        data: { rawInput: "toast", items: [], notes: "" },
      }),
    ).rejects.toThrow("Not authenticated");
  });

  describe("food log with rawInput + empty items (new-style)", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("stores the log and schedules processLogInternal", async () => {
      const t = convexTest(schema);
      const userId = "add-rawInput-user";
      const now = Date.now();

      const logId = await t.withIdentity({ subject: userId }).mutation(api.logs.add, {
        timestamp: now,
        type: "food",
        data: { rawInput: "toast, honey", items: [], notes: "" },
      });

      // Log should be persisted
      await t.run(async (ctx) => {
        const rawLog = await ctx.db.get(logId);
        if (rawLog === null) throw new Error("expected log");
        const log = rawLog as Doc<"logs">;
        expect(log.type).toBe("food");
        expect(log.userId).toBe(userId);
        const data = log.data as { rawInput?: string; items: unknown[] };
        expect(data.rawInput).toBe("toast, honey");
        expect(data.items).toHaveLength(0);
      });

      // No ingredient exposures yet (new-style waits for pipeline)
      await t.run(async (ctx) => {
        const exposures = await ctx.db
          .query("ingredientExposures")
          .withIndex("by_userId_logId", (q) => q.eq("userId", userId).eq("logId", logId))
          .collect();
        expect(exposures).toHaveLength(0);
      });

      // The scheduled processLogInternal should have been queued.
      // Running timers + finishing scheduled functions exercises that branch.
      vi.runAllTimers();
      await t.finishInProgressScheduledFunctions();

      // After processing, items should be populated
      await t.run(async (ctx) => {
        const rawLog = await ctx.db.get(logId);
        if (rawLog === null) throw new Error("expected log after processing");
        const data = (rawLog as Doc<"logs">).data as {
          items: Array<{ parsedName?: string; canonicalName?: string }>;
        };
        expect(data.items.length).toBeGreaterThan(0);
        expect(data.items[0].canonicalName).toBe("toast");
      });
    });
  });

  describe("food log with pre-filled items (legacy path)", () => {
    it("creates ingredient exposures immediately", async () => {
      const t = convexTest(schema);
      const userId = "add-legacy-user";
      const now = Date.now();

      const logId = await t.withIdentity({ subject: userId }).mutation(api.logs.add, {
        timestamp: now,
        type: "food",
        data: {
          items: [
            {
              name: "banana",
              canonicalName: "ripe banana",
              quantity: null,
              unit: null,
            },
            {
              name: "toast",
              canonicalName: "toast",
              quantity: 2,
              unit: "slice",
            },
          ],
          notes: "",
        },
      });

      // Exposures should exist immediately (no scheduling)
      await t.run(async (ctx) => {
        const exposures = await ctx.db
          .query("ingredientExposures")
          .withIndex("by_userId_logId", (q) => q.eq("userId", userId).eq("logId", logId))
          .collect();
        expect(exposures).toHaveLength(2);

        const canonicals = exposures.map((e) => e.canonicalName).sort();
        expect(canonicals).toEqual(["ripe banana", "toast"]);

        // Verify fields propagated correctly
        const toastExposure = exposures.find((e) => e.canonicalName === "toast");
        if (toastExposure === undefined) throw new Error("expected toast exposure");
        expect(toastExposure.ingredientName).toBe("toast");
        expect(toastExposure.quantity).toBe(2);
        expect(toastExposure.unit).toBe("slice");
        expect(toastExposure.logTimestamp).toBe(now);
      });
    });

    it("skips exposure for items missing canonicalName", async () => {
      const t = convexTest(schema);
      const userId = "add-legacy-no-canonical";

      const logId = await t.withIdentity({ subject: userId }).mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "food",
        data: {
          items: [
            {
              name: "mystery food",
              quantity: null,
              unit: null,
            },
          ],
          notes: "",
        },
      });

      // No canonicalName on the item, so getCanonicalizedFoodItems returns null
      // and rebuildIngredientExposuresForFoodLog inserts 0 exposures
      await t.run(async (ctx) => {
        const exposures = await ctx.db
          .query("ingredientExposures")
          .withIndex("by_userId_logId", (q) => q.eq("userId", userId).eq("logId", logId))
          .collect();
        expect(exposures).toHaveLength(0);
      });
    });
  });

  describe("non-food log types", () => {
    it("adds and retrieves a bowel/digestion log", async () => {
      const t = convexTest(schema);
      const userId = "add-digestion-user";
      const now = Date.now();

      const logId = await t.withIdentity({ subject: userId }).mutation(api.logs.add, {
        timestamp: now,
        type: "digestion",
        data: {
          bristolCode: 4,
          urgencyTag: "normal",
          notes: "All good",
        },
      });

      expect(logId).toBeDefined();

      const logs = await t.withIdentity({ subject: userId }).query(api.logs.list, {});
      expect(logs).toHaveLength(1);
      expect(logs[0].type).toBe("digestion");
      const data = logs[0].data as { bristolCode: number };
      expect(data.bristolCode).toBe(4);
    });

    it("adds and retrieves a fluid log", async () => {
      const t = convexTest(schema);
      const userId = "add-fluid-user";

      await t.withIdentity({ subject: userId }).mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "fluid",
        data: {
          items: [{ name: "Water", quantity: 500, unit: "ml" }],
        },
      });

      const logs = await t.withIdentity({ subject: userId }).query(api.logs.list, {});
      expect(logs).toHaveLength(1);
      expect(logs[0].type).toBe("fluid");
      const data = logs[0].data as {
        items: Array<{ name: string; quantity: number }>;
      };
      expect(data.items[0].name).toBe("Water");
      expect(data.items[0].quantity).toBe(500);
    });

    it("adds and retrieves a habit log", async () => {
      const t = convexTest(schema);
      const userId = "add-habit-user";

      await t.withIdentity({ subject: userId }).mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "habit",
        data: {
          habitId: "habit_water_0",
          name: "Water",
          habitType: "fluid",
          quantity: 250,
        },
      });

      const logs = await t.withIdentity({ subject: userId }).query(api.logs.list, {});
      expect(logs).toHaveLength(1);
      expect(logs[0].type).toBe("habit");
    });

    it("adds and retrieves an activity log", async () => {
      const t = convexTest(schema);
      const userId = "add-activity-user";

      await t.withIdentity({ subject: userId }).mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "activity",
        data: {
          activityType: "walking",
          durationMinutes: 30,
          feelTag: "good",
        },
      });

      const logs = await t.withIdentity({ subject: userId }).query(api.logs.list, {});
      expect(logs).toHaveLength(1);
      expect(logs[0].type).toBe("activity");
    });

    it("adds and retrieves a weight log", async () => {
      const t = convexTest(schema);
      const userId = "add-weight-user";

      await t.withIdentity({ subject: userId }).mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "weight",
        data: { weightKg: 72.5 },
      });

      const logs = await t.withIdentity({ subject: userId }).query(api.logs.list, {});
      expect(logs).toHaveLength(1);
      expect(logs[0].type).toBe("weight");
      const data = logs[0].data as { weightKg: number };
      expect(data.weightKg).toBe(72.5);
    });

    it("adds and retrieves a reproductive log", async () => {
      const t = convexTest(schema);
      const userId = "add-repro-user";

      await t.withIdentity({ subject: userId }).mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "reproductive",
        data: {
          entryType: "cycle" as const,
          periodStartDate: "2026-03-10",
          bleedingStatus: "light" as const,
          symptoms: ["cramps" as const, "bloating" as const],
          notes: "Day 2",
        },
      });

      const logs = await t.withIdentity({ subject: userId }).query(api.logs.list, {});
      expect(logs).toHaveLength(1);
      expect(logs[0].type).toBe("reproductive");
      const data = logs[0].data as { periodStartDate: string };
      expect(data.periodStartDate).toBe("2026-03-10");
    });

    it("does not create ingredient exposures for non-food types", async () => {
      const t = convexTest(schema);
      const userId = "add-nonfood-no-exposure";

      await t.withIdentity({ subject: userId }).mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "digestion",
        data: { bristolCode: 3 },
      });

      await t.run(async (ctx) => {
        const exposures = await ctx.db
          .query("ingredientExposures")
          .withIndex("by_userId", (q) => q.eq("userId", userId))
          .collect();
        expect(exposures).toHaveLength(0);
      });
    });
  });
});

// ---------------------------------------------------------------------------
// update mutation
// ---------------------------------------------------------------------------

describe("logs.update", () => {
  it("rejects unauthenticated access", async () => {
    const t = convexTest(schema);
    const userId = "update-auth-user";

    // Create a log first
    const logId = await t.withIdentity({ subject: userId }).mutation(api.logs.add, {
      timestamp: Date.now(),
      type: "digestion",
      data: { bristolCode: 4 },
    });

    // Try to update without auth
    await expect(
      t.mutation(api.logs.update, {
        id: logId,
        timestamp: Date.now(),
        data: { bristolCode: 5 },
      }),
    ).rejects.toThrow("Not authenticated");
  });

  it("rejects updates to another user's log", async () => {
    const t = convexTest(schema);

    const logId = await t.withIdentity({ subject: "owner-user" }).mutation(api.logs.add, {
      timestamp: Date.now(),
      type: "digestion",
      data: { bristolCode: 4 },
    });

    await expect(
      t.withIdentity({ subject: "intruder-user" }).mutation(api.logs.update, {
        id: logId,
        timestamp: Date.now(),
        data: { bristolCode: 5 },
      }),
    ).rejects.toThrow("Not authorized");
  });

  describe("food log with rawInput (new-style update)", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("clears old exposures and schedules processLogInternal", async () => {
      const t = convexTest(schema);
      const userId = "update-rawInput-user";
      const now = Date.now();

      // Create a legacy food log with pre-filled items (exposures created immediately)
      const logId = await t.withIdentity({ subject: userId }).mutation(api.logs.add, {
        timestamp: now,
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

      // Verify exposures exist from the legacy add
      await t.run(async (ctx) => {
        const exposures = await ctx.db
          .query("ingredientExposures")
          .withIndex("by_userId_logId", (q) => q.eq("userId", userId).eq("logId", logId))
          .collect();
        expect(exposures).toHaveLength(1);
      });

      // Update with rawInput (new-style) — should clear old exposures
      await t.withIdentity({ subject: userId }).mutation(api.logs.update, {
        id: logId,
        timestamp: now + 1000,
        data: { rawInput: "honey, banana", items: [], notes: "" },
      });

      // Old exposures should be cleared
      await t.run(async (ctx) => {
        const exposures = await ctx.db
          .query("ingredientExposures")
          .withIndex("by_userId_logId", (q) => q.eq("userId", userId).eq("logId", logId))
          .collect();
        expect(exposures).toHaveLength(0);
      });

      // processLogInternal was scheduled — run it
      vi.runAllTimers();
      await t.finishInProgressScheduledFunctions();

      // Items should now be parsed
      await t.run(async (ctx) => {
        const rawLog = await ctx.db.get(logId);
        if (rawLog === null) throw new Error("expected log after update processing");
        const data = (rawLog as Doc<"logs">).data as {
          rawInput: string;
          items: Array<{ canonicalName?: string }>;
        };
        expect(data.rawInput).toBe("honey, banana");
        expect(data.items.length).toBeGreaterThan(0);
      });
    });
  });

  describe("food log without rawInput (legacy update)", () => {
    it("rebuilds ingredient exposures immediately", async () => {
      const t = convexTest(schema);
      const userId = "update-legacy-user";
      const now = Date.now();

      // Create a legacy food log
      const logId = await t.withIdentity({ subject: userId }).mutation(api.logs.add, {
        timestamp: now,
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

      // Verify initial exposure
      await t.run(async (ctx) => {
        const exposures = await ctx.db
          .query("ingredientExposures")
          .withIndex("by_userId_logId", (q) => q.eq("userId", userId).eq("logId", logId))
          .collect();
        expect(exposures).toHaveLength(1);
        expect(exposures[0].canonicalName).toBe("toast");
      });

      // Update with different items (legacy — no rawInput)
      await t.withIdentity({ subject: userId }).mutation(api.logs.update, {
        id: logId,
        timestamp: now + 1000,
        data: {
          items: [
            {
              name: "honey",
              canonicalName: "honey",
              quantity: null,
              unit: null,
            },
            {
              name: "banana",
              canonicalName: "ripe banana",
              quantity: 1,
              unit: null,
            },
          ],
          notes: "updated",
        },
      });

      // Exposures should be rebuilt immediately with new items
      await t.run(async (ctx) => {
        const exposures = await ctx.db
          .query("ingredientExposures")
          .withIndex("by_userId_logId", (q) => q.eq("userId", userId).eq("logId", logId))
          .collect();
        expect(exposures).toHaveLength(2);
        const canonicals = exposures.map((e) => e.canonicalName).sort();
        expect(canonicals).toEqual(["honey", "ripe banana"]);
      });
    });
  });

  describe("non-food log update", () => {
    it("updates a digestion log without touching exposures", async () => {
      const t = convexTest(schema);
      const userId = "update-nonfood-user";
      const now = Date.now();

      const logId = await t.withIdentity({ subject: userId }).mutation(api.logs.add, {
        timestamp: now,
        type: "digestion",
        data: { bristolCode: 3 },
      });

      await t.withIdentity({ subject: userId }).mutation(api.logs.update, {
        id: logId,
        timestamp: now + 1000,
        data: { bristolCode: 5, notes: "improved" },
      });

      const logs = await t.withIdentity({ subject: userId }).query(api.logs.list, {});
      expect(logs).toHaveLength(1);
      expect(logs[0].timestamp).toBe(now + 1000);
      const data = logs[0].data as { bristolCode: number; notes?: string };
      expect(data.bristolCode).toBe(5);
      expect(data.notes).toBe("improved");

      // No exposures should exist for non-food
      await t.run(async (ctx) => {
        const exposures = await ctx.db
          .query("ingredientExposures")
          .withIndex("by_userId", (q) => q.eq("userId", userId))
          .collect();
        expect(exposures).toHaveLength(0);
      });
    });

    it("updates a fluid log", async () => {
      const t = convexTest(schema);
      const userId = "update-fluid-user";
      const now = Date.now();

      const logId = await t.withIdentity({ subject: userId }).mutation(api.logs.add, {
        timestamp: now,
        type: "fluid",
        data: { items: [{ name: "Water", quantity: 250, unit: "ml" }] },
      });

      await t.withIdentity({ subject: userId }).mutation(api.logs.update, {
        id: logId,
        timestamp: now,
        data: { items: [{ name: "Tea", quantity: 200, unit: "ml" }] },
      });

      const logs = await t.withIdentity({ subject: userId }).query(api.logs.list, {});
      const data = logs[0].data as {
        items: Array<{ name: string; quantity: number }>;
      };
      expect(data.items[0].name).toBe("Tea");
      expect(data.items[0].quantity).toBe(200);
    });
  });
});

// ---------------------------------------------------------------------------
// remove mutation
// ---------------------------------------------------------------------------

describe("logs.remove", () => {
  it("rejects unauthenticated access", async () => {
    const t = convexTest(schema);
    const userId = "remove-auth-user";

    const logId = await t.withIdentity({ subject: userId }).mutation(api.logs.add, {
      timestamp: Date.now(),
      type: "digestion",
      data: { bristolCode: 4 },
    });

    await expect(t.mutation(api.logs.remove, { id: logId })).rejects.toThrow("Not authenticated");
  });

  it("rejects deletion of another user's log", async () => {
    const t = convexTest(schema);

    const logId = await t.withIdentity({ subject: "owner" }).mutation(api.logs.add, {
      timestamp: Date.now(),
      type: "digestion",
      data: { bristolCode: 4 },
    });

    await expect(
      t.withIdentity({ subject: "intruder" }).mutation(api.logs.remove, { id: logId }),
    ).rejects.toThrow("Not authorized");
  });

  it("clears ingredient exposures when a food log is deleted", async () => {
    const t = convexTest(schema);
    const userId = "remove-food-user";

    const logId = await t.withIdentity({ subject: userId }).mutation(api.logs.add, {
      timestamp: Date.now(),
      type: "food",
      data: {
        items: [
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

    // Verify exposure was created
    await t.run(async (ctx) => {
      const exposures = await ctx.db
        .query("ingredientExposures")
        .withIndex("by_userId_logId", (q) => q.eq("userId", userId).eq("logId", logId))
        .collect();
      expect(exposures).toHaveLength(1);
    });

    // Delete
    await t.withIdentity({ subject: userId }).mutation(api.logs.remove, { id: logId });

    // Log should be gone
    await t.run(async (ctx) => {
      const log = await ctx.db.get(logId);
      expect(log).toBeNull();
    });

    // Exposures should be cleared
    await t.run(async (ctx) => {
      const exposures = await ctx.db
        .query("ingredientExposures")
        .withIndex("by_userId_logId", (q) => q.eq("userId", userId).eq("logId", logId))
        .collect();
      expect(exposures).toHaveLength(0);
    });
  });

  it("deletes a non-food log without touching exposures", async () => {
    const t = convexTest(schema);
    const userId = "remove-nonfood-user";

    const logId = await t.withIdentity({ subject: userId }).mutation(api.logs.add, {
      timestamp: Date.now(),
      type: "digestion",
      data: { bristolCode: 6 },
    });

    await t.withIdentity({ subject: userId }).mutation(api.logs.remove, { id: logId });

    const logs = await t.withIdentity({ subject: userId }).query(api.logs.list, {});
    expect(logs).toHaveLength(0);
  });

  it("deletes a food log with multiple items and clears all exposures", async () => {
    const t = convexTest(schema);
    const userId = "remove-multi-user";

    const logId = await t.withIdentity({ subject: userId }).mutation(api.logs.add, {
      timestamp: Date.now(),
      type: "food",
      data: {
        items: [
          {
            name: "toast",
            canonicalName: "toast",
            quantity: 2,
            unit: "slice",
          },
          {
            name: "honey",
            canonicalName: "honey",
            quantity: null,
            unit: null,
          },
          {
            name: "banana",
            canonicalName: "ripe banana",
            quantity: 1,
            unit: null,
          },
        ],
        notes: "",
      },
    });

    // Verify 3 exposures created
    await t.run(async (ctx) => {
      const exposures = await ctx.db
        .query("ingredientExposures")
        .withIndex("by_userId_logId", (q) => q.eq("userId", userId).eq("logId", logId))
        .collect();
      expect(exposures).toHaveLength(3);
    });

    // Delete
    await t.withIdentity({ subject: userId }).mutation(api.logs.remove, { id: logId });

    // All exposures gone
    await t.run(async (ctx) => {
      const exposures = await ctx.db
        .query("ingredientExposures")
        .withIndex("by_userId_logId", (q) => q.eq("userId", userId).eq("logId", logId))
        .collect();
      expect(exposures).toHaveLength(0);
    });
  });

  it("deleting one of several food logs only clears exposures for that log", async () => {
    // Regression: removing log A must not cascade-delete exposures from log B
    // for the same user. Each log's exposures are scoped by logId.
    const t = convexTest(schema);
    const userId = "remove-cascade-isolation-user";
    const base = Date.now();

    const logIdA = await t.withIdentity({ subject: userId }).mutation(api.logs.add, {
      timestamp: base,
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

    const logIdB = await t.withIdentity({ subject: userId }).mutation(api.logs.add, {
      timestamp: base + 1000,
      type: "food",
      data: {
        items: [
          {
            name: "banana",
            canonicalName: "ripe banana",
            quantity: null,
            unit: null,
          },
          {
            name: "honey",
            canonicalName: "honey",
            quantity: null,
            unit: null,
          },
        ],
        notes: "",
      },
    });

    // Verify total exposures: 1 for A, 2 for B
    await t.run(async (ctx) => {
      const allExposures = await ctx.db
        .query("ingredientExposures")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
      expect(allExposures).toHaveLength(3);
    });

    // Delete only log A
    await t.withIdentity({ subject: userId }).mutation(api.logs.remove, { id: logIdA });

    // Log A exposures must be gone
    await t.run(async (ctx) => {
      const aExposures = await ctx.db
        .query("ingredientExposures")
        .withIndex("by_userId_logId", (q) => q.eq("userId", userId).eq("logId", logIdA))
        .collect();
      expect(aExposures).toHaveLength(0);
    });

    // Log B exposures must be untouched
    await t.run(async (ctx) => {
      const bExposures = await ctx.db
        .query("ingredientExposures")
        .withIndex("by_userId_logId", (q) => q.eq("userId", userId).eq("logId", logIdB))
        .collect();
      expect(bExposures).toHaveLength(2);
      const canonicals = bExposures.map((e) => e.canonicalName).sort();
      expect(canonicals).toEqual(["honey", "ripe banana"]);
    });
  });

  it("deleting all food logs for a user clears all their exposures", async () => {
    // Verifies that repeated remove calls correctly clean up the full exposure set.
    const t = convexTest(schema);
    const userId = "remove-all-logs-user";
    const base = Date.now();

    const logIds: Id<"logs">[] = [];
    for (let i = 0; i < 3; i++) {
      const logId = await t.withIdentity({ subject: userId }).mutation(api.logs.add, {
        timestamp: base + i * 1000,
        type: "food",
        data: {
          items: [
            {
              name: "toast",
              canonicalName: "toast",
              quantity: i + 1,
              unit: "slice",
            },
          ],
          notes: "",
        },
      });
      logIds.push(logId);
    }

    // 3 logs × 1 item each = 3 exposures
    await t.run(async (ctx) => {
      const all = await ctx.db
        .query("ingredientExposures")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
      expect(all).toHaveLength(3);
    });

    // Delete all logs sequentially
    for (const id of logIds) {
      await t.withIdentity({ subject: userId }).mutation(api.logs.remove, { id });
    }

    // No exposures should remain
    await t.run(async (ctx) => {
      const remaining = await ctx.db
        .query("ingredientExposures")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
      expect(remaining).toHaveLength(0);
    });
  });

  it("deleting a food log does not affect another user's exposures", async () => {
    // Cross-user isolation: Alice's delete must not touch Bob's exposures.
    const t = convexTest(schema);
    const base = Date.now();

    const aliceLogId = await t.withIdentity({ subject: "alice-cascade" }).mutation(api.logs.add, {
      timestamp: base,
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

    const bobLogId = await t.withIdentity({ subject: "bob-cascade" }).mutation(api.logs.add, {
      timestamp: base,
      type: "food",
      data: {
        items: [
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

    // Delete Alice's log
    await t
      .withIdentity({ subject: "alice-cascade" })
      .mutation(api.logs.remove, { id: aliceLogId });

    // Alice's exposures gone
    await t.run(async (ctx) => {
      const aliceExposures = await ctx.db
        .query("ingredientExposures")
        .withIndex("by_userId", (q) => q.eq("userId", "alice-cascade"))
        .collect();
      expect(aliceExposures).toHaveLength(0);
    });

    // Bob's exposures untouched
    await t.run(async (ctx) => {
      const bobExposures = await ctx.db
        .query("ingredientExposures")
        .withIndex("by_userId_logId", (q) => q.eq("userId", "bob-cascade").eq("logId", bobLogId))
        .collect();
      expect(bobExposures).toHaveLength(1);
      expect(bobExposures[0].canonicalName).toBe("ripe banana");
    });
  });
});

// ---------------------------------------------------------------------------
// list query
// ---------------------------------------------------------------------------

describe("logs.list", () => {
  it("rejects unauthenticated access", async () => {
    const t = convexTest(schema);
    await expect(t.query(api.logs.list, {})).rejects.toThrow("Not authenticated");
  });

  it("returns logs scoped to the authenticated user", async () => {
    const t = convexTest(schema);
    const now = Date.now();

    await t.withIdentity({ subject: "alice" }).mutation(api.logs.add, {
      timestamp: now,
      type: "digestion",
      data: { bristolCode: 3 },
    });
    await t.withIdentity({ subject: "bob" }).mutation(api.logs.add, {
      timestamp: now + 1000,
      type: "digestion",
      data: { bristolCode: 5 },
    });

    const aliceLogs = await t.withIdentity({ subject: "alice" }).query(api.logs.list, {});
    expect(aliceLogs).toHaveLength(1);
    const aliceData = aliceLogs[0].data as { bristolCode: number };
    expect(aliceData.bristolCode).toBe(3);

    const bobLogs = await t.withIdentity({ subject: "bob" }).query(api.logs.list, {});
    expect(bobLogs).toHaveLength(1);
    const bobData = bobLogs[0].data as { bristolCode: number };
    expect(bobData.bristolCode).toBe(5);
  });

  it("returns logs in descending timestamp order", async () => {
    const t = convexTest(schema);
    const userId = "list-order-user";
    const base = Date.now();

    for (let i = 0; i < 5; i++) {
      await t.withIdentity({ subject: userId }).mutation(api.logs.add, {
        timestamp: base + i * 1000,
        type: "digestion",
        data: { bristolCode: (i + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7 },
      });
    }

    const logs = await t.withIdentity({ subject: userId }).query(api.logs.list, {});
    expect(logs).toHaveLength(5);
    // Most recent first
    expect(logs[0].timestamp).toBe(base + 4000);
    expect(logs[4].timestamp).toBe(base);
  });

  it("respects the limit parameter", async () => {
    const t = convexTest(schema);
    const userId = "list-limit-user";
    const base = Date.now();

    for (let i = 0; i < 10; i++) {
      await t.withIdentity({ subject: userId }).mutation(api.logs.add, {
        timestamp: base + i * 1000,
        type: "digestion",
        data: { bristolCode: 4 },
      });
    }

    const logs = await t.withIdentity({ subject: userId }).query(api.logs.list, { limit: 3 });
    expect(logs).toHaveLength(3);
    // Should be the 3 most recent
    expect(logs[0].timestamp).toBe(base + 9000);
  });

  it("clamps limit to minimum 1", async () => {
    const t = convexTest(schema);
    const userId = "list-clamp-user";

    await t.withIdentity({ subject: userId }).mutation(api.logs.add, {
      timestamp: Date.now(),
      type: "digestion",
      data: { bristolCode: 4 },
    });

    // Even a 0 or negative limit should return at least 1
    const logs = await t.withIdentity({ subject: userId }).query(api.logs.list, { limit: 0 });
    expect(logs).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// listByRange query
// ---------------------------------------------------------------------------

describe("logs.listByRange", () => {
  it("rejects unauthenticated access", async () => {
    const t = convexTest(schema);
    await expect(t.query(api.logs.listByRange, { startMs: 0, endMs: Date.now() })).rejects.toThrow(
      "Not authenticated",
    );
  });

  it("returns only logs within the time range", async () => {
    const t = convexTest(schema);
    const userId = "range-user";
    const base = 1_000_000;

    // Create logs at base, base+1000, base+2000, base+3000
    for (let i = 0; i < 4; i++) {
      await t.withIdentity({ subject: userId }).mutation(api.logs.add, {
        timestamp: base + i * 1000,
        type: "digestion",
        data: { bristolCode: (i + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7 },
      });
    }

    // Query range [base+1000, base+3000) — should get logs at 1000 and 2000 only
    const logs = await t.withIdentity({ subject: userId }).query(api.logs.listByRange, {
      startMs: base + 1000,
      endMs: base + 3000,
    });
    expect(logs).toHaveLength(2);
    // Descending order
    expect(logs[0].timestamp).toBe(base + 2000);
    expect(logs[1].timestamp).toBe(base + 1000);
  });

  it("returns empty array when no logs match the range", async () => {
    const t = convexTest(schema);
    const userId = "range-empty-user";

    await t.withIdentity({ subject: userId }).mutation(api.logs.add, {
      timestamp: 1_000_000,
      type: "digestion",
      data: { bristolCode: 4 },
    });

    const logs = await t.withIdentity({ subject: userId }).query(api.logs.listByRange, {
      startMs: 2_000_000,
      endMs: 3_000_000,
    });
    expect(logs).toHaveLength(0);
  });

  it("does not leak logs between users", async () => {
    const t = convexTest(schema);
    const base = 1_000_000;

    await t.withIdentity({ subject: "alice" }).mutation(api.logs.add, {
      timestamp: base,
      type: "digestion",
      data: { bristolCode: 4 },
    });
    await t.withIdentity({ subject: "bob" }).mutation(api.logs.add, {
      timestamp: base + 500,
      type: "digestion",
      data: { bristolCode: 6 },
    });

    const aliceLogs = await t.withIdentity({ subject: "alice" }).query(api.logs.listByRange, {
      startMs: base - 1000,
      endMs: base + 10_000,
    });
    expect(aliceLogs).toHaveLength(1);
    const aliceData = aliceLogs[0].data as { bristolCode: number };
    expect(aliceData.bristolCode).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// rebuildIngredientExposuresForFoodLog — exercised via legacy add/update
// ---------------------------------------------------------------------------

describe("rebuildIngredientExposuresForFoodLog (via legacy mutations)", () => {
  it("propagates recovery stage and spice level into exposures", async () => {
    const t = convexTest(schema);
    const userId = "rebuild-fields-user";
    const now = Date.now();

    const logId = await t.withIdentity({ subject: userId }).mutation(api.logs.add, {
      timestamp: now,
      type: "food",
      data: {
        items: [
          {
            name: "toast",
            canonicalName: "toast",
            quantity: 1,
            unit: "slice",
            recoveryStage: 2,
            spiceLevel: "mild" as const,
            preparation: "toasted",
          },
        ],
        notes: "",
      },
    });

    await t.run(async (ctx) => {
      const exposures = await ctx.db
        .query("ingredientExposures")
        .withIndex("by_userId_logId", (q) => q.eq("userId", userId).eq("logId", logId))
        .collect();
      expect(exposures).toHaveLength(1);
      expect(exposures[0].recoveryStage).toBe(2);
      expect(exposures[0].spiceLevel).toBe("mild");
      expect(exposures[0].preparation).toBe("toasted");
      expect(exposures[0].itemIndex).toBe(0);
    });
  });

  it("replaces old exposures on legacy update (idempotent rebuild)", async () => {
    const t = convexTest(schema);
    const userId = "rebuild-replace-user";
    const now = Date.now();

    const logId = await t.withIdentity({ subject: userId }).mutation(api.logs.add, {
      timestamp: now,
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
            name: "honey",
            canonicalName: "honey",
            quantity: null,
            unit: null,
          },
        ],
        notes: "",
      },
    });

    // Should have 2 exposures
    await t.run(async (ctx) => {
      const exposures = await ctx.db
        .query("ingredientExposures")
        .withIndex("by_userId_logId", (q) => q.eq("userId", userId).eq("logId", logId))
        .collect();
      expect(exposures).toHaveLength(2);
    });

    // Update to completely different items
    await t.withIdentity({ subject: userId }).mutation(api.logs.update, {
      id: logId,
      timestamp: now,
      data: {
        items: [
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

    // Old exposures should be replaced — now only 1
    await t.run(async (ctx) => {
      const exposures = await ctx.db
        .query("ingredientExposures")
        .withIndex("by_userId_logId", (q) => q.eq("userId", userId).eq("logId", logId))
        .collect();
      expect(exposures).toHaveLength(1);
      expect(exposures[0].canonicalName).toBe("ripe banana");
    });
  });

  it("uses userSegment as ingredientName when available", async () => {
    const t = convexTest(schema);
    const userId = "rebuild-usersegment-user";
    const now = Date.now();

    const logId = await t.withIdentity({ subject: userId }).mutation(api.logs.add, {
      timestamp: now,
      type: "food",
      data: {
        items: [
          {
            userSegment: "two slices of toast",
            parsedName: "toast",
            canonicalName: "toast",
            resolvedBy: "registry" as const,
            quantity: 2,
            unit: "slice",
          },
        ],
        notes: "",
      },
    });

    await t.run(async (ctx) => {
      const exposures = await ctx.db
        .query("ingredientExposures")
        .withIndex("by_userId_logId", (q) => q.eq("userId", userId).eq("logId", logId))
        .collect();
      expect(exposures).toHaveLength(1);
      // userSegment takes priority over rawName / parsedName / name
      expect(exposures[0].ingredientName).toBe("two slices of toast");
    });
  });
});

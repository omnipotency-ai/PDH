Perfect! Now I have a comprehensive view of the issue. Let me write a summary report.

---

## WQ-087 Research Report: Unbounded `.collect()` in SyncedLogsContext

### Current Query (The Problem)

**Location:** `/Users/peterjamesblizzard/projects/caca_traca/convex/logs.ts` lines 741-760

```typescript
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error("Not authenticated");
    const userId = identity.subject;
    const rows = await ctx.db
      .query("logs")
      .withIndex("by_userId_timestamp", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();  // ← UNBOUNDED COLLECTION

    return rows.map((row) => ({
      id: row._id,
      timestamp: row.timestamp,
      type: row.type,
      data: row.data,
    }));
  },
});
```

The `.collect()` call fetches ALL logs for the authenticated user with no date window, pagination, or hard limit.

---

### All Consumers of `useAllSyncedLogs()`

1. **`src/contexts/SyncedLogsContext.tsx`** (line 10)
   - Wraps logs in a React context
   - Feeds into `rebuildHabitLogsFromSyncedLogs()` to derive habit logs

2. **`src/pages/Track.tsx`** (lines 113, 188-194)
   - Filters logs by `selectedStart`/`selectedEnd` (single day window)
   - Computes day statistics: habit counts, fluid totals, BM count, etc.
   - Uses for quick capture, habit detail sheets, and today status row

3. **`src/pages/Patterns.tsx`** (lines 453, 461-468)
   - Passes to `analyzeLogs()` for food statistics and trial history
   - Computes food stats, resolved trials, baseline evidence

4. **`src/pages/secondary_pages/Menu.tsx`** (lines 210, 218-219)
   - Passes to `analyzeLogs()` for food safety grid and status counts
   - Needs all-time data for food trial history and zone classification

5. **`src/components/patterns/hero/HeroStrip.tsx`** (lines 12-14)
   - Filters digestion logs from context
   - Computes BM frequency (last 7 days) and Bristol trend tiles

6. **`src/components/track/quick-capture/WeightEntryDrawer.tsx`** (lines 39, 43-56)
   - Filters weight logs
   - Tracks weight trend history for delta calculations (previous weight, post-surgery delta)

---

### Analysis: What Window Do Consumers Need?

| Consumer | Time Window Required | Reason | 
|----------|---------------------|--------|
| **Track (day view)** | 1 day (current) | Shows today's logs only; other dates navigable via offset |
| **Track (habits derivation)** | All-time | Habit logs persist across session for streak tracking & detailed history |
| **Patterns (food analysis)** | All-time | Food trials, zone classification, and evidence accumulation span the entire recovery |
| **Menu (food safety)** | All-time | Food verdicts built from cumulative trial data |
| **HeroStrip (BM trend)** | ~7-14 days | Recent BM frequency & Bristol trend, not full history |
| **WeightEntryDrawer** | All-time | Weight journey from surgery to present |

**Key finding:** Transit time analysis (96 hours minimum) is NOT a constraint here because Patterns/Menu analyze food *cumulative* evidence over months. Weekly trends in HeroStrip need ~7-14 days. **The app genuinely needs all-time logs.**

---

### Available Index

The schema provides a well-designed index:

```typescript
// convex/schema.ts line 38-39
.index("by_userId", ["userId"])
.index("by_userId_timestamp", ["userId", "timestamp"])
```

The query correctly uses `by_userId_timestamp`, so index performance is already optimized.

---

### Recommended Fix: Apply a Hard Limit + Lazy Loading

Since consumers genuinely need all-time data but unbounded `.collect()` is dangerous for large datasets, implement a **hard safety limit** with **explicit lazy loading**:

**Option A: Hard Limit (Immediate, Low-Risk)**
- Modify `listAll` to cap at a safe number (e.g., 10,000 or 50,000 logs)
- Add a `nextCursor` return value for pagination
- Consumers don't change: they get the most recent N logs plus a cursor for older data
- Trade-off: Recent ~100 days of data (typical usage) is loaded; older archives need explicit pagination

**Option B: Lazy Loading Hook (More Sophisticated)**
- Create new hook `useAllSyncedLogsWithCursor()` that returns paginated chunks
- Modify consumers to load incrementally (Patterns could load additional log windows on demand)
- More control but requires consumer refactoring

**Option C: Date Window + Explicit Archival (Longest-Term)**
- Create a companion `useArchivedSyncedLogs(startDate, endDate)` hook
- Modify `listAll` to return only logs from the last 6 months
- Archive older logs to a separate table for historical queries
- Most scalable but requires schema changes and migration

---

### Specific Code Approach (Option A - Recommended)

```typescript
// convex/logs.ts

const MAX_LOGS_PER_QUERY = 50000; // Safety ceiling

export const listAll = query({
  args: {
    cursor: v.optional(v.string()), // Base64-encoded timestamp cursor
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error("Not authenticated");
    const userId = identity.subject;
    
    let query = ctx.db
      .query("logs")
      .withIndex("by_userId_timestamp", (q) => q.eq("userId", userId))
      .order("desc");
    
    // If cursor provided, only fetch logs older than cursor
    if (args.cursor) {
      const decodedTimestamp = parseInt(atob(args.cursor), 10);
      query = query.lt("timestamp", decodedTimestamp);
    }
    
    // Fetch one extra to detect if more pages exist
    const rows = await query.take(MAX_LOGS_PER_QUERY + 1);
    
    const hasMore = rows.length > MAX_LOGS_PER_QUERY;
    const logRows = rows.slice(0, MAX_LOGS_PER_QUERY);
    
    const nextCursor = hasMore && logRows.length > 0
      ? btoa(String(logRows[logRows.length - 1].timestamp))
      : null;
    
    return {
      logs: logRows.map((row) => ({
        id: row._id,
        timestamp: row.timestamp,
        type: row.type,
        data: row.data,
      })),
      nextCursor,
    };
  },
});
```

Update the hook:

```typescript
// src/lib/syncLogs.ts

export function useAllSyncedLogs(): SyncedLog[] {
  const logs = useQuery(api.logs.listAll, { cursor: undefined });
  return useMemo(() => toSyncedLogs(logs?.logs ?? []), [logs]);
}
```

Consumers remain unchanged; they get safe, bounded data.

---

### Summary

| Aspect | Finding |
|--------|---------|
| **Current Query** | Unbounded `.collect()` at line 751 of `convex/logs.ts` |
| **Index Available** | Yes: `by_userId_timestamp` is perfect for this query |
| **Consumers** | 6 files; all genuinely need all-time data (food trials, habits, weight) |
| **Minimum Viable Window** | All-time (no safe time-based cutoff exists) |
| **Recommended Fix** | Apply hard limit (50k logs) + cursor-based pagination for older data |
| **Risk Level** | High for production; large user datasets will hit memory/timeout limits |
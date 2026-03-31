I now have all the data I need. Here is the full audit.

---

## Work Queue Audit: Internal Consistency Issues

### Category 1: ID Collisions (same WQ-### used for different items)

**1. WQ-320 — Two unrelated items share this ID**
- Line 246 (Sprint 2.7 Wave 1): "Hand-authored map geometry" — status: `open`
- Line 288 (Sprint 3 Error Handling): "Delete handlers in SubRows have no error handling" — status: `open`
- **Fix:** Reassign the Sprint 3 item to a new ID (WQ-372 is the next available).

**2. WQ-321 — Two unrelated items share this ID**
- Line 247 (Sprint 2.7 Wave 1): "Corridor color palette" — status: `open`
- Line 301 (Sprint 3 Accessibility): "Sparkline gradient ID breaks with CSS variable colors" �� status: `open`
- **Fix:** Reassign the Sprint 3 item to a new ID (WQ-373).

**3. WQ-322 through WQ-329 — Eight ID collisions between Sprint 2.7 and Sprint 7**
- WQ-322: "TransitMapCanvas SVG component" (Sprint 2.7, line 253, open) vs. "foodAssessments.byReport post-filter auth gap" (Sprint 7, line 527, done)
- WQ-323: "StationCallout inline detail" (Sprint 2.7, line 254, open) vs. "OpenAI calls: inadequate error handling" (Sprint 7, line 528, done)
- WQ-324: "TransitMapZoomController" (Sprint 2.7, line 255, open) vs. "API key validation runs after OpenAI client creation" (Sprint 7, line 529, done)
- WQ-325: "Wire into Patterns page" (Sprint 2.7, line 261, open) vs. "Race conditions in upsert mutations" (Sprint 7, line 530, done)
- WQ-326: "Delete list-based components" (Sprint 2.7, line 262, open) vs. "No error handling on ctx.scheduler.runAfter()" (Sprint 7, line 531, done)
- WQ-327: "Delete Model Guide + mock data" (Sprint 2.7, line 263, open) vs. "allIngredients truncates at 5K" (Sprint 7, line 532, done)
- WQ-328: "Quality gate" (Sprint 2.7, line 269, open) vs. "No profile existence check before storing API key" (Sprint 7, line 533, done)
- WQ-329: "Browser verification" (Sprint 2.7, line 270, open) vs. "Missing integer validation on quantity fields" (Sprint 7, line 534, done)
- **Fix:** Renumber the entire Sprint 2.7 block. WQ-320 through WQ-329 were clearly pre-allocated for Sprint 2.7, but then Sprint 7 reused the same IDs. Reassign Sprint 2.7 items to WQ-374 through WQ-383 (or any free range above 371).

### Category 2: Conflicting Statuses for the Same Item

**4. WQ-080 through WQ-086 — "done" in Transit Map Visuals Wave 0, "open" in Sprint 3 Base UI**
Code verification confirms the work IS done:
- `switch.tsx`: imports `@base-ui/react/switch`, uses `data-[checked]`/`data-[unchecked]`
- `tabs.tsx`: imports `@base-ui/react/tabs`, uses `data-[active]`
- `toggle-group.tsx`: imports `@base-ui/react/toggle-group` (Base UI migrated)
- `accordion.tsx`: imports `@base-ui/react/accordion`, uses `data-[panel-open]`
- `DeleteConfirmDrawer.tsx`: imports `@base-ui/react/dialog`, uses `data-[starting-style]`/`data-[ending-style]`
- **Fix:** Mark the Sprint 3 Base UI Migration entries (lines 309-315) as `done` with a note like "Done in Transit Map Visuals Wave 0." The summary note on line 646 already says "WQ-080-086 done by Codex" but the Sprint 3 table rows contradict this.

**5. WQ-062 — "deferred" in Sprint 2, "done" in Sprint 2.5**
- Line 114 (Sprint 2): status `deferred`, description "Bundled with WQ-051 LLM pipeline work"
- Line 136 (Sprint 2.5 Wave 4): status `done`
- **Fix:** Update the Sprint 2 entry on line 114 to `done` with a note pointing to Sprint 2.5 Wave 4.

**6. WQ-039 — "moved" in Sprint 1, "done" in Transit Map Visuals**
- Line 84 (Sprint 1): status `moved`
- Line 233 (Transit Map Visuals Wave 2): status `done`
- These are not contradictory (moved + done at destination is valid), but the Sprint 1 description still says "Moved to Sprint 2.6" while the destination is now labeled "Transit Map Visuals."
- **Fix:** Minor — update Sprint 1 description to say "Moved to Transit Map Visuals Wave 2" for consistency.

**7. WQ-040 — Same issue as WQ-039**
- Line 85 (Sprint 1): status `moved`
- Line 234 (Transit Map Visuals Wave 2): status `done`
- **Fix:** Same as WQ-039 — update the "Moved to Sprint 2.6" text.

**8. WQ-147 — "moved" in Sprint 6, "done" in Transit Map Visuals**
- Line 423 (Sprint 6): status `moved`, description says "Moved to Sprint 2.6 Wave 3"
- Line 231 (Transit Map Visuals Wave 3): status `done`
- **Fix:** No action needed, but the Sprint 6 reference says "Sprint 2.6" while the section is now titled "Transit Map Visuals."

**9. WQ-160 �� "moved" in Sprint 6, "done" in Transit Map Visuals**
- Line 441 (Sprint 6): status `moved`
- Line 232 (Transit Map Visuals Wave 3): status `done`
- **Fix:** Same minor naming issue as WQ-147.

### Category 3: Items Marked "done" but Work NOT Actually Done

**10. WQ-008 — Claims "Replaced v.any() with backupPayloadValidator" but v.any() is still pervasive**
- Line 34: done, claims "Eliminated 13 `as any` casts"
- Code reality: `convex/logs.ts` lines 1667-1682 contain 14 `v.any()` calls in the `backupPayloadValidator`. The validator itself IS present (line 1663), but it uses `v.any()` for every array element. The comment at line 1657 explains this is intentional ("backup data may [vary]"), so WQ-008 is arguably done with a caveat. However, the description is misleading: "Replaced `v.any()` with `backupPayloadValidator`" implies v.any() was eliminated.
- **Fix:** Update the description to clarify that per-row validation uses `v.any()` intentionally (backup payloads have variable schemas). The WQ-008 description implies stronger type safety than actually exists.

**11. WQ-059 — Marked "done" but file still exists**
- Line 111: done, description says "Investigation: DELETE. Migration obsolete"
- Code reality: `src/lib/migrateLegacyStorage.ts` still exists and is imported by `src/routeTree.tsx`.
- **Fix:** The "done" status covers the investigation, not the deletion. The description says "Delete in Sprint 6" but no Sprint 6 item tracks this. Either add a Sprint 6 follow-up item or change status to indicate the investigation is done but the deletion is pending.

**12. WQ-096 — Marked "closed" referencing WQ-060 deletion, but WQ-060's deletion hasn't happened yet either**
- Line 334: closed, "Stale -- file already deleted in WQ-060"
- Code reality: `src/lib/digestiveCorrelations.ts` does NOT exist (confirmed deleted), so WQ-096 is correctly closed. However, WQ-060 itself is marked "done" with "Delete in Sprint 6," suggesting the investigation was done but the file deletion was a separate action. The actual file IS deleted, so no issue here. This is consistent.

**13. WQ-159 — Marked "open" but `"use client"` directives are still present (not a false-done)**
- Listed as open on line 440. Code confirms `"use client"` is present in 6 files: `toggle.tsx`, `toggle-group.tsx`, `switch.tsx`, `drawer.tsx`, `date-picker.tsx`, `tabs.tsx`.
- The description lists only 3 files (`date-picker.tsx`, `tabs.tsx`, `toggle.tsx`) but there are actually 6 files.
- **Fix:** Update the file list in WQ-159 to include all 6 affected files.

### Category 4: Items Possibly Already Resolved

**14. WQ-094 — "analyzeLogs called twice" may not be an issue anymore**
- Line 332: open, "Both call analyzeLogs independently. Lift to shared context"
- Code reality: `Patterns.tsx` and `Menu.tsx` both still independently call `analyzeLogs`. This item is still genuinely open.

**15. WQ-152 — "key?: string in all SubRow props" is still present**
- Line 428: open. Code confirms `key?: string | number` is still in the props destructuring of all 5 SubRow editors (FluidSubRow, HabitSubRow, ReproductiveSubRow, WeightSubRow, FoodSubRow).
- Genuinely open.

### Category 5: Orphaned Cross-References

**16. WQ-400 through WQ-406 referenced in summary but not defined in the file**
- Line 650: "Sprint 2.7 (WQ-400-WQ-406) in progress separately"
- No WQ-400 through WQ-406 items exist anywhere in the file body. The Sprint 2.7 section uses WQ-320 through WQ-329 (which themselves are collisions per Finding #3).
- **Fix:** Either add the WQ-400-406 items to the Sprint 2.7 section or remove the phantom reference from line 650.

**17. WQ-327 in Sprint 2.7 references WQ-213 and WQ-214**
- Line 263: "Completes WQ-213/214"
- WQ-213 (line 229) and WQ-214 (line 230) exist and are `blocked`. This cross-reference is valid.

### Category 6: Summary Table Inaccuracies

**18. Sprint 2.5 counts are wrong**
- Summary (line 632): Total 20, Done 16, Open 4
- Actual: 22 rows, 22 done, 0 open
- **Fix:** Update to Total 22, Done 22, Open 0.

**19. Sprint 2.5+ counts are wrong**
- Summary (line 633): Total 19, Done 15, Open 2, Future 1, Moved 1
- Actual: 18 rows, 16 done, 0 open, 1 blocked, 1 review. No "moved" items.
- **Fix:** Update to Total 18, Done 16, Blocked 1, Review 1.

**20. Transit Map Visuals (Sprint 2.6) counts are wrong**
- Summary (line 634): Total 12, Done 5, Future 5, Moved 2
- Actual: 19 rows, 17 done, 2 blocked, 0 moved.
- **Fix:** Update to Total 19, Done 17, Blocked 2.

**21. Sprint 2.7 counts are wrong**
- Summary (line 635): Total 10, Done 3, Open 7
- Actual: 10 rows, 0 done, 10 open.
- **Fix:** Update to Total 10, Done 0, Open 10.

**22. Sprint 3 counts are wrong**
- Summary (line 636): Total 24, Done 14, Open 2, Moved 7, Descoped 1
- Actual: 24 rows, 14 done, 9 open, 0 moved, 1 strikethrough (~~WQ-072~~). The 7 "open" items in the Base UI section (WQ-080-086) are really done (see Finding #4), which makes this a tangled inconsistency.
- **Fix:** If Base UI items are corrected to done, then: Total 24, Done 21, Open 2 (WQ-320, WQ-321 -- but those are ID collisions), 1 strikethrough.

**23. Sprint 4 counts are wrong**
- Summary (line 637): Total 24, Done 19, Open 3, Future 1
- Actual: 24 rows, 17 done, 5 open, 1 blocked, 1 closed. "Future" is not a recognized status.
- **Fix:** Update to Total 24, Done 17, Open 5, Blocked 1, Closed 1.

**24. Sprint 5 counts are wrong**
- Summary (line 638): Total 26, Done 2, Open 24
- Actual: 33 rows, 8 done, 25 open.
- **Fix:** Update to Total 33, Done 8, Open 25.

**25. Sprint 6 counts are wrong**
- Summary (line 639): Total 55, Done 0, Open 55
- Actual: 55 rows, 4 done (WQ-144, WQ-145, WQ-146, WQ-149), 2 moved (WQ-147, WQ-160), ~47 open, 2 closed (WQ-360, WQ-096... wait, WQ-096 is in Sprint 4). Let me re-examine. The Sprint 6 section has 55 rows: checking done count.
- Actual: 4 done, 2 moved, 49 open. Not "0 done" as claimed.
- **Fix:** Update to Total 55, Done 4, Open 49, Moved 2.

**26. Sprint 7 counts are slightly off**
- Summary (line 640): Total 50, Done 30, Open 18, Descoped 2
- Actual: 50 rows, 31 done, 16 open, 2 strikethrough (~~WQ-331~~, ~~WQ-359~~), 1 closed (WQ-360).
- **Fix:** Verify and reconcile. The count of "done" should be 31 not 30; "open" should be 16 not 18.

**27. The grand total (line 642) is wrong**
- Claims: Total 311, Done 156, Open 102, Future 6, Moved 18, Descoped 12
- Actual total item rows: 326 (including duplicates from same IDs appearing in multiple sprints). Unique WQ items are fewer. The summary is counting from a stale snapshot and doesn't account for items appearing in multiple sprints with different statuses.
- **Fix:** Rebuild the summary table from scratch after fixing all the above issues.

### Category 7: ID Gap / Numbering Issues

**28. Gap from WQ-372 to WQ-399 (28 unused IDs)**
- The file jumps from WQ-371 to WQ-400. This is not technically an error but worth noting, as it means "next available ID" is actually WQ-372, not what one might guess from scanning the bottom of the file.

**29. WQ-400 through WQ-406 referenced but only WQ-400 and WQ-406 appear in the file**
- WQ-401 through WQ-405 are never defined. The summary line references "WQ-400-WQ-406" as if they're a block, but only WQ-400 appears in the summary note (line 650) and nowhere as table rows.
- **Fix:** These items need to be defined if they exist, or the reference should be removed.

### Summary of Recommended Actions (in priority order)

1. **Reassign Sprint 2.7 IDs** (WQ-320-329) to free range (WQ-374+) to resolve 10 ID collisions.
2. **Reassign Sprint 3 WQ-320 and WQ-321** to new IDs to resolve 2 more collisions.
3. **Mark Sprint 3 Base UI items (WQ-080-086) as done** -- code confirms migration is complete.
4. **Update Sprint 2 WQ-062** from `deferred` to `done`.
5. **Remove or define WQ-400-406** reference on line 650.
6. **Add Sprint 6 deletion item** for WQ-059's `migrateLegacyStorage.ts`.
7. **Rebuild the entire summary table** -- nearly every row has stale counts.
8. **Update WQ-008 description** to clarify `v.any()` remains intentionally in backup validator.
9. **Update WQ-159 file list** from 3 files to 6 files.
10. **Standardize "Sprint 2.6" references** to "Transit Map Visuals" in moved-item descriptions.
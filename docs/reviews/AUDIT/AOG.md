# Caca Traca — Audit Orchestration Guide

**Date:** 2026-03-16
**Purpose:** Run 5 parallel audits using different AI tools to produce ground-truth documentation

---

## Pre-Flight Checklist

Before running any audits:

- [ ] Commit all 56 pending changes to `codex/chore/food-registry`
- [ ] Merge branch to `main`
- [ ] Push to GitHub (Manus needs the repo)
- [ ] Verify `bun run typecheck` passes (agents need a clean starting point)
- [ ] Verify `bun run build` passes

---

## The 5 Audits

| # | Audit | Tool | Input | Time | Output |
| - | ----- | ---- | ----- | ---- | ------ |
| 1 | Codebase Health Review | Claude Code | Local filesystem | 60–90 min | `CODEBASE_HEALTH_AUDIT.md` |
| 2 | Plan vs Implementation Gap | GPT 5.4 | Repo + docs | 45–60 min | `GAP_ANALYSIS.md` |
| 3 | Code Map + Import Trace | Manus | GitHub clone | 45–60 min | `CODE_INDEX.md` + `CODE_HEALTH_MAP.md` |
| 4 | Deep File Review | Gemini 3.1 Pro | 6 large files | 90–120 min | `DEEP_FILE_AUDIT.md` |
| 5 | Doc Cross-Reference | NotebookLM | 16 doc files | 30–45 min | `DOC_HEALTH_ASSESSMENT.md` |

### Recommended Parallel Execution

```bash
TIME    TOOL            AUDIT
─────   ──────────────  ──────────────────────────────
0:00    Claude Code     Start Audit 1 (hands-off after prompt)
0:05    GPT 5.4         Start Audit 2 Phase 1
0:10    NotebookLM      Start Audit 5 (load docs, run queries)
0:15    Gemini 3.1 Pro  Start Audit 4 File 1 (aiAnalysis.ts)
0:30    GPT 5.4         Phase 2 (if Phase 1 done)
0:35    Gemini 3.1 Pro  File 2 (foodRegistry.ts)
0:45    NotebookLM      Should be done — compile results
0:55    Gemini 3.1 Pro  File 3 (logs.ts)
1:00    GPT 5.4         Phase 3 + 4
1:15    Gemini 3.1 Pro  File 4 (migrations.ts)
1:30    Claude Code     Should be done
1:30    GPT 5.4         Phase 5 (consolidation)
1:35    Gemini 3.1 Pro  File 5 + 6
1:45    Manus           Start Audit 3 (can run anytime after push)
2:00    GPT 5.4         Should be done
2:30    Gemini 3.1 Pro  Compile all reviews
2:45    Manus           Should be done
```

You can realistically have all 5 done in ~3 hours, with much of it running in parallel.

---

## After All Audits Complete

### Step 1: Collect the 6 output documents

1. `CODEBASE_HEALTH_AUDIT.md` (from Claude Code)
2. `GAP_ANALYSIS.md` (from GPT 5.4)
3. `CODE_INDEX.md` (from Manus)
4. `CODE_HEALTH_MAP.md` (from Manus)
5. `DEEP_FILE_AUDIT.md` (from Gemini)
6. `DOC_HEALTH_ASSESSMENT.md` (from NotebookLM)

### Step 2: Upload all 6 to this Claude Project

Add them to the project knowledge. Then ask me to:

> "Synthesize the 6 audit reports into the SINGLE-SOURCE documentation structure we discussed. Build me:
>
> 1. `features.md` — master feature list with verified statuses
> 2. `bugs.md` — master bug list with verified statuses
> 3. `tech-debt.md` — master tech debt list with verified statuses
> 4. Project READMEs for each active workstream
> 5. A prioritized action plan for the next 2 weeks"

### Step 3: Replace the docs

Take the new SINGLE-SOURCE files and the project READMEs, put them in the repo, and archive everything they replace.

---

## What Each Audit Is Best At Finding

Understanding this helps you know which audit to trust when they disagree:

| Finding Type | Most Reliable Audit |
| ------------ | ------------------- |
| Security vulnerabilities | Audit 1 (Claude Code) — has full context |
| Dead code / orphans | Audit 3 (Manus) — mechanical import tracing |
| Doc accuracy | Audit 2 (GPT 5.4) — doc-to-code verification |
| Deep logic bugs | Audit 4 (Gemini) — single-file deep dive |
| Doc contradictions | Audit 5 (NotebookLM) — cross-reference specialist |
| Performance issues | Audit 1 (Claude Code) + Audit 4 (Gemini) |
| Missing tests | Audit 1 (Claude Code) |
| Architecture violations | Audit 3 (Manus) — import direction analysis |

### When Audits Disagree

If two audits report different things about the same item:

1. **Code wins over docs.** Always.
2. **More specific wins over general.** Gemini's line-by-line review > Claude Code's file-level sweep.
3. **Mechanical wins over judgment.** Manus's import trace > any tool's opinion about whether code is "used."
4. **Flag it for manual verification** if you're still unsure.

---

## Cost Estimate

Rough token/compute costs (your mileage will vary):

| Tool | Estimated Cost |
| ---- | -------------- |
| Claude Code (Audit 1) | ~$5–15 depending on parallel agent count |
| GPT 5.4 (Audit 2) | ~$3–8 for 4 phases of sub-agents |
| Manus (Audit 3) | Depends on your plan |
| Gemini 3.1 Pro (Audit 4) | ~$2–5 for 6 large file reviews |
| NotebookLM (Audit 5) | Free (included in Google account) |
| **Total** | **~$10–30** |

This is dramatically cheaper than the alternative: manually reading 250 files and 36 documents yourself.

---

## Prompt Files Reference

All prompts are saved as separate files:

| File | Tool | Audit |
| ---- | ---- | ----- |
| `A1_CC_codebase-health.md` | Claude Code | Codebase Health Review |
| `A2_G_5-4_gap-analysis.md` | GPT 5.4 | Plan vs Implementation Gap |
| `A3_M_code-map.md` | Manus | Code Map + Import Trace |
| `A4_G_3-1_deep-file-review.md` | Gemini 3.1 Pro | Deep File Review |
| `A5_NLM_doc-cross-ref.md` | NotebookLM | Doc Cross-Reference |

# Food Matching Refactor Migration Plan

**Branch:** `refactor/food-matching` (initial work), continued on `codex/chore/food-registry`

## Goal

Replace the current `registry exact lookup -> client-triggered LLM match -> manual modal` flow with a server-first matching pipeline:

1. deterministic pre-processing
2. fuzzy search as the primary matcher
3. embedding search as a parallel semantic matcher
4. confidence-based routing into auto-map, candidate confirmation, or bucket choice
5. LLM fallback only for rare ambiguous leftovers

## What Gets Replaced

- `convex/foodParsing.ts` stops treating exact registry canonicalization as the main matcher.
- `src/hooks/useFoodLlmMatching.ts` and `convex/foodLlmMatching.ts` stop being the normal unresolved-item path.
- `FoodMatchingModal` stops being a generic full-registry picker for every miss and becomes a confidence-resolution UI fed by server candidates/buckets.
- "Request it be added" is no longer the first fallback for unknown phrasing; user-approved aliasing becomes the default learning mechanism.

## What Stays

- `shared/foodRegistry.ts` remains the source of truth for Zone 1 and Zone 2 food data and metadata.
- `logs.add` / `logs.update` still schedule server-side processing from `rawInput`.
- `rawInput` stays sacred, `data.items[]` stays the working writeback shape, and `processEvidence` still creates `ingredientExposures` after the 6-hour window.
- Existing React entry points stay in place: the Track page review queue, row-level unresolved-item entry points, and the `resolveItem` mutation path.

## New Pipeline Shape

### 1. Pre-processing

- Move normalization/splitting into a shared deterministic layer that:
  - strips quantities and units while keeping them separately
  - splits on commas plus conjunction/preposition boundaries such as `and`, `with`, `y`
  - lowercases, trims, strips accents, and normalizes punctuation
- Output is an ordered list of clean food phrases plus quantity metadata.

### 2. Primary retrieval

- Build a server-side Fuse.js index from `shared/foodRegistry.ts` over:
  - canonical name
  - examples
  - learned aliases
- Add embedding-backed semantic retrieval for the same registry items.
- Combine fuzzy score + embedding similarity into a single confidence score per phrase.

### 3. Confidence routing

- High confidence: write `canonicalName`, `resolvedBy: "registry"`, confidence metadata, and continue with no UI interruption.
- Medium confidence: write candidate options onto the item and surface them in `FoodMatchingModal` as 2–3 choices.
- Low confidence: write bucket choices onto the item and let the modal collect a coarse category selection before aliasing.
- Very low confidence plus structural ambiguity: call the LLM with the phrase and top candidates only after the other layers fail.

## Data / Schema Changes

- Add a Convex alias table for user-approved phrase -> food mappings, with support for user-scoped and global aliases.
- Add a Convex embedding table for registry items so vectors are queryable with a vector index without moving food metadata out of `shared/foodRegistry.ts`.
- Extend food log items with matching state needed by the UI, likely including confidence, strategy, candidate IDs, and bucket metadata.
- Keep `canonicalName` as the evidence/aggregation contract so downstream analysis code does not need a full rewrite in this branch.

## UI Integration

- Keep the existing queue and row-level modal entry points.
- Change `FoodMatchingModal` to render server-provided candidates first, then bucket choices, with full-registry search as a secondary escape hatch rather than the default screen.
- Keep `resolveItem`, but expand it so a user choice also persists an alias and clears any pending candidate/bucket state for that item.
- Remove the background `useFoodLlmMatching` loop once the server pipeline owns unresolved routing.

## Migration Order

- [x] 1. Add shared phrase pre-processing and tests.
- [x] 2. Add alias + embedding storage and server-side retrieval utilities.
- [x] 3. Refactor `processLog` to run the new matcher and write richer item state.
- [x] 4. Rework `FoodMatchingModal` and `resolveItem` around candidate confirmation / bucket selection / alias creation.
- [x] 5. Downgrade the LLM path to explicit fallback-only usage and remove the current client auto-trigger.
- [x] 6. Update tests around parsing, matching, modal flows, and evidence invariants.

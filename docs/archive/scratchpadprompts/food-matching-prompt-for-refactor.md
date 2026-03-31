# Food Matching — Initial Refactor Prompt (SUPERSEDED)

> **Status (2026-03-15): This is the original prompt used to kick off the food system rebuild. It describes the desired architecture as of early 2026. Phases 1–4.6 are now complete and the implemented architecture differs in several ways from what is described here.**
>
> **What was implemented instead:**
>
> - No Fuse.js fuzzy search, no embedding search — deterministic registry lookup is the primary matching path
> - LLM is a binary matcher (match to registry OR `NOT_ON_LIST`), not a confidence-scored multi-candidate system
> - No `foods`/`aliases` Convex collections — the registry lives in `shared/foodRegistry.ts` (static, developer-only)
> - No `createFoodAlias` — users match via `FoodMatchingModal` which calls `resolveItem` mutation
> - Food parsing is server-side (`convex/foodParsing.ts`), not client-side
> - The `Food` schema described here was never implemented; see `shared/foodRegistry.ts` for the actual type
>
> **Current architecture:** See `docs/scratchpadprompts/food-data-flow.md` and `docs/scratchpadprompts/food-system-rebuild.md`.
>
> This file is kept for historical context only.

---

# Original Prompt (archived)

> You are helping refactor and extend a post‑surgery diet tracking app called **Caca Traca**.  
> Tech stack: **React + Vite** frontend, **Convex** backend. The domain is **food reintroduction after ileostomy/colorectal surgery**, with strong emphasis on **low‑residue diets** and **digestive tolerance zones**. [elht.nhs](https://elht.nhs.uk/application/files/3315/8556/0327/DIET-002-LowFibrelowresiduediet-2019.pdf)
>
> ## Core domain model
>
> We have a **3‑zone system** for foods:
>
> - **Zone 1** – “baseline safe”:
>   - Very low residue, low fat, no strong spices, usually liquid, purée or very soft.
>   - Examples: clear broths, strained soups, purees (potato, carrot, pumpkin), poached/boiled white fish and chicken, very soft egg preparations, a few low‑fat dairy items, and soaked refined carbs. [webmd](https://www.webmd.com/ibd-crohns-disease/crohns-disease/low-residue-diet-foods)
> - **Zone 2** – “tolerable but more varied”:
>   - Still relatively low residue, but more texture, more variety, and moderate fat/sugar.
>   - Includes: soft breads and crackers, boiled root veg chunks, soft cooked non‑crucifer veg, peeled soft fruits, standard dairy portions, grilled/baked lean meats, mild savoury & sweet snacks. [compgihealth](https://compgihealth.com/2025/04/low-residue-diet/)
> - **Zone 3** – “risky / high challenge”:
>   - High fat, high insoluble fiber, skins, seeds, spicy, gassy or otherwise high‑risk foods (nuts, legumes, popcorn, spicy crisps, dried fruit, etc.). Not fully specced yet but same schema should support it. [perplexity](https://www.perplexity.ai/search/b5a30651-a630-44f8-9224-1ad28b1feb14)
>
> Foods are organised into **groups (“stations”)**, each with **example strings** that should match user logs. Example:
>
> - Group: `"boiled_root_veg"` / name: “Boiled root vegetables (peeled, soft)”
> - Examples: `"boiled carrots"`, `"boiled sweet potato"`, `"boiled new potatoes (peeled)"` etc. [perplexity](https://www.perplexity.ai/search/b5a30651-a630-44f8-9224-1ad28b1feb14)
>
> Each food or group has this **shared schema**:
>
> ```ts
> type Zone = 1 | 2 | 3;
> type Macro =
>   | "carb"
>   | "protein"
>   | "fat"
>   | "mixed"
>   | "dairy_protein"
>   | "dairy_fat_protein";
>
> interface Food {
>   id: string; // stable id, e.g. "z1_carb_010"
>   canonicalName: string; // e.g. "Boiled root vegetables (peeled, soft)"
>   groupKey: string; // e.g. "boiled_root_veg"
>   zone: Zone;
>   macro: Macro;
>   examples: string[]; // strings we want to match, e.g. "boiled carrots"
>
>   // digestion metadata
>   osmoticEffect:
>     | "none"
>     | "low"
>     | "low_moderate"
>     | "moderate"
>     | "moderate_high";
>   totalResidue: "very_low" | "low" | "low_moderate" | "moderate" | "high";
>   fiberTotalApproxG: number; // approximate per serving
>   fiberInsolubleLevel: "low" | "low_moderate" | "moderate" | "high";
>   fiberSolubleLevel: "low" | "low_moderate" | "moderate" | "high";
>   gasProducing: "no" | "possible" | "yes";
>   dryTexture: "no" | "low" | "yes"; // dry/bulky vs soft/wet
>   irritantLoad: "none" | "low" | "moderate" | "high"; // spice, acid, garlic/onion, etc.
>
>   progressionHint?: string; // free‑text UI hint (optional)
> }
>
> interface FoodAlias {
>   id: string;
>   aliasText: string; // user text, as typed or spoken
>   foodId: string; // FK to Food
>   userId?: string | null; // null for global aliases
>   createdAt: number;
> }
> ```
>
> These should be Convex documents (`foods` and `aliases` collections). [uofmhealth](https://www.uofmhealth.org/sites/default/files/2024-11/LowFiberLowResidueDiet.pdf)
>
> ## What already exists conceptually
>
> We have:
>
> - A **Zone 1 food list** of ~44 items, already structured to fit this schema (broths, purees, soft proteins, basic dairy, etc.). [elht.nhs](https://elht.nhs.uk/application/files/3315/8556/0327/DIET-002-LowFibrelowresiduediet-2019.pdf)
> - A **Zone 2 list** with grouped entries like:
>   - `soft_white_bread`, `plain_crackers`, `crispy_crackers_savory`, `white_rice_pasta`, `refined_cereal_dry`
>   - `boiled_root_veg`, `soft_non_crucifer_veg`
>   - `soft_peeled_fruit`, `canned_fruit_soft`, `fruit_puree_extended`
>   - `lean_poultry_grilled`, `white_fish_grilled`, `lean_minced_meat`, `egg_extended`, `soft_cheese`, `soft_plant_protein_extended`
>   - `added_fat_zone2`, `dairy_standard`
>   - `savoury_snacks_basic`, `savoury_snacks_cheese`, `sweet_snacks_low_fiber`, `sweet_snacks_choc_plain`.  
>     Each station has `examples` and curated metadata values as above. [uhsussex.nhs](https://www.uhsussex.nhs.uk/wp-content/uploads/2022/04/2109.1-Low-residue-diet-2024.pdf)
>
> You can assume those JSON objects exist and just need to be stored and queried cleanly.
>
> ## Matching pipeline (NLP) – required refactor
>
> We want to refactor the meal‑logging pipeline to make **natural language inputs match registry foods with minimal friction**. Research points to a **hybrid approach: regex + fuzzy search + embeddings, with LLM only as a fallback**. [sciencedirect](https://www.sciencedirect.com/science/article/pii/S2475299123151687)
>
> **Target behaviour:**
>
> - User types or speaks something like:  
>   `"2 slices of toast with butter and jam, and a bowl of chicken noodle soup"`
> - System should:
>   1. Parse it into items (`"toast with butter"`, `"jam"`, `"chicken noodle soup"` + quantities).
>   2. Map each item to the closest `Food` (or group) using:
>      - Regex & string rules (for quantities/units)
>      - Fuzzy match over `canonicalName` + `examples` + `aliasText`
>      - Embedding similarity to `Food` descriptions
>   3. If a match is confident, auto‑map. If unclear, ask the user via a small UI prompt to confirm or pick a better option.
>   4. Save any new user‑approved mapping as a `FoodAlias` so we don’t have to ask again. [jmir](https://www.jmir.org/2021/12/e26988/)
>
> **Design decisions to implement:**
>
> 1. **Pre‑processing (cheap layer)**
>    - Use regex / small parser to:
>      - Extract quantities and units (keep them; we’ll use later).
>      - Split meal text into candidate food phrases (split on commas, “and”, “with”, etc.).
>      - Normalize case, accents, punctuation. [ml6](https://www.ml6.eu/en/blog/hybrid-machine-learning-marrying-nlp-and-regex)
> 2. **Fuzzy search**
>    - Use a fuzzy search library (e.g. Fuse.js) either in the React client or in a Convex function.
>    - Build an index over `foods.canonicalName`, `foods.examples`, and `aliases.aliasText`. [meilisearch](https://www.meilisearch.com/blog/fuzzy-search)
>    - For each parsed phrase, get top N matches with scores.
> 3. **Embedding search**
>    - Use an embedding model (OpenAI, Anthropic, etc.) to embed:
>      - Each `Food` document (e.g. canonicalName + groupKey + macro + maybe a short description).
>      - Each new user phrase. [pmc.ncbi.nlm.nih](https://pmc.ncbi.nlm.nih.gov/articles/PMC11957177/)
>    - Implement a nearest‑neighbour search in Convex for semantic similarity.
> 4. **Combiner / confidence logic**
>    - For each phrase, combine fuzzy score + embedding similarity into a simple confidence score.
>    - Rules of thumb:
>      - High confidence: auto‑map to that `foodId`.
>      - Medium: return 2–3 candidates and let the UI ask the user “Which is closest?”.
>      - Low: show a bucket chooser (e.g. “boiled veg”, “grilled meat”, “sweet snack”) and create a `FoodAlias` from the user’s choice. [tanzhou](https://www.tanzhou.space/project/accessibility-design-food-journaling-through-conversational-agent/)
> 5. **Optional LLM fallback**
>    - Only for really messy inputs or ambiguous cases:
>      - Provide the LLM with the original phrase + top candidate foods + their metadata.
>      - Ask it to choose the best match or say “none”.
>    - This is an exception path to keep latency and cost low. [private-ai](https://www.private-ai.com/en/blog/1412)
>
> **Convex API we need:**
>
> - `parseAndMatchMeal(rawText: string, userId: string): Promise<MatchedItem[]>`
>   - Runs pre‑processing, fuzzy + embeddings, optional LLM, and returns structured items:
>
> ```ts
> interface MatchedItem {
>   rawText: string; // "boiled parsnips"
>   quantity?: string; // "2 slices", "1 bowl"
>   foodId: string | null; // if mapped
>   groupKey?: string | null; // for grouping/visuals
>   zone?: Zone;
>   macro?: Macro;
>   confidence: number; // 0–1
>   isNewAliasSuggestion?: boolean;
> }
> ```
>
> - `searchFoods(query: string): Promise<Food[]>`
>   - For change‑mapping UI (user manually picks a different food).
> - `createFoodAlias(aliasText: string, foodId: string, userId?: string)`
>   - Called when user confirms a mapping we weren’t confident about.
>
> ## Frontend UX requirements (React)
>
> 1. **Single “What did you eat?” input**
>    - User types or uses voice (STT handled separately) → we call `parseAndMatchMeal`.
>    - Show a list of resolved items, each as a row/chip:
>      - Text (what user said)
>      - Mapped canonical/group name (e.g. “Boiled root vegetables”)
>      - Zone badge (`Z1/Z2/Z3` colour‑coded)
>      - Macro badge (C/P/F)
>      - A small “Change” button.
> 2. **Change mapping UI**
>    - On “Change”, open a bottom sheet with:
>      - Quick bucket choices (Boiled veg, Grilled meat, Sweet snack, etc.).
>      - Search box powered by `searchFoods` with fuzzy suggestions.
> 3. **Alias creation**
>    - When the user picks an alternative, call `createFoodAlias` so next time that phrase auto‑maps.
> 4. **Voice input**
>    - Voice in the client converts to text, then goes through the same pipeline.
>    - After STT, we always show the parsed items and let the user confirm/correct before final save. [ceur-ws](https://ceur-ws.org/Vol-4053/paper14.pdf)
>
> ## Your tasks
>
> 1. Design / confirm the **Convex schemas** for `foods`, `aliases`, and `meal_logs` using the interfaces above.
> 2. Implement the **matching pipeline** (`parseAndMatchMeal`) with clear separation of:
>    - parsing → fuzzy → embeddings → optional LLM → final `MatchedItem[]`.
> 3. Implement `searchFoods` and `createFoodAlias`.
> 4. Provide simple **React hooks/components** that wrap these calls:
>    - `useMealMatcher()` for submitting raw text and displaying matched items.
>    - A bottom sheet component for changing mappings.
>
> Use the JSON examples I provide in the appendix as the initial `foods` seed data (Zone 1 and Zone 2). Don’t change their IDs or digestion metadata; refactor storage and matching code around them.
>
> If anything in this spec is ambiguous, ask clarification questions before implementing.

> **Note:** This is a research document exploring potential matching approaches. The production architecture uses deterministic registry lookup with LLM fallback as described in [ADR 0002](../adrs/0002-food-registry-and-canonicalization.md). Some concepts from this research informed the current design, but this document does not describe what is currently implemented.

You’ll get the least friction with a **hybrid pipeline: cheap rules + fuzzy search + embeddings, with LLM and user confirmation only for low‑confidence or truly new foods.**
Voice becomes “just another way to produce text” that feeds this same pipeline. [sciencedirect](https://www.sciencedirect.com/science/article/pii/S2475299123151687)

---

## Overall architecture

Think of your matcher as three layers:

1. **Deterministic pre‑processing**
   - Regex & simple token rules to strip units, numbers, time phrases, and split meals into food phrases. [ml6](https://www.ml6.eu/en/blog/hybrid-machine-learning-marrying-nlp-and-regex)
   - Normalize case, accents, punctuation; map common synonyms (“spuds” → “potatoes”, “sarnie” → “sandwich”).

2. **Fast approximate matching against your registry**
   - Fuzzy string search (Fuse.js in the React client or Convex function) over canonical names + synonyms + group names (“boiled root veg”, “crispy crackers”, etc.). [meilisearch](https://www.meilisearch.com/blog/fuzzy-search)
   - Vector / embedding search (Convex + an embedding API) for semantic similarity (“creamy vegetable soup” → “strained veg soup” group). [pmc.ncbi.nlm.nih](https://pmc.ncbi.nlm.nih.gov/articles/PMC11957177/)

3. **Fallback & refinement**
   - If confidence is high, auto‑map.
   - If medium, show a quick confirmation UI (chips).
   - If low / OOV, ask the user a minimal question or let them choose a group (Carb / Protein / Fat / Snack), then store a new alias so next time it’s automatic. [jmir](https://www.jmir.org/2021/12/e26988/)

This is exactly the pattern successful food‑logging research systems use: ML/LLM + retrieval for mapping free text to a food database, with light user correction when needed. [digitalhealthcrc](https://digitalhealthcrc.com/big-thinkers/transforming-food-logging-with-ai-streamlining-dietary-tracking-for-better-health-outcomes-with-vineeth-ramesh/)

---

## Step‑by‑step text matching strategy

### 1. Pre‑processing (cheap, deterministic)

Use simple regex + tokenization for the non‑contextual pieces: [private-ai](https://www.private-ai.com/en/blog/1412)

- Strip quantities & units into a separate structure:
  - `"2 slices of toast with butter and jam"` →
    - items: `"toast with butter"`, `"jam"`
    - quantities: `"2 slices"`, implicit `"some"`
  - Regex buckets:
    - amounts: `(\d+(\.\d+)?)`
    - units: `g|gram(s)?|ml|cup(s)?|slice(s)?|piece(s)?|bowl(s)?`
- Split on obvious delimiters: `,`, `and`, `with`, `y` (ES), etc.
- Normalize text: lowercase, trim spaces, strip accents (important for Spanish/Catalan).

You do _not_ want to regex your way to full semantic understanding; you only use it to get the text into a shape where fuzzy search + embeddings work well. [ml6](https://www.ml6.eu/en/blog/hybrid-machine-learning-marrying-nlp-and-regex)

---

### 2. Fuzzy search against your registry

Maintain a **food registry in Convex**:

- `id`
- `canonicalName` (e.g. `"boiled root vegetables (peeled, soft)"`)
- `examples` (strings like `"boiled carrots"`, `"boiled new potatoes"`)
- `groupKey` (`"boiled_root_veg"`)
- `zone`, `macro`, and all the metadata you’ve defined.

On the matching side:

- Build a **Fuse.js index** on `canonicalName` + `examples` client‑side or in a Convex function.
- Configure for high precision, moderate recall (you don’t want wild matches): [meilisearch](https://www.meilisearch.com/blog/fuzzy-search)
  - `keys: ['canonicalName', 'examples']`
  - `threshold: ~0.3–0.4`
  - `minMatchCharLength: 3`
- For each parsed item phrase (e.g. `"boiled parsnips"`), run fuzzy search, take top N candidates with scores.

Fuzzy search gives you robustness to typos and voice mis‑recognitions (“quelitas” vs “kelitas”) at low cost. [stackoverflow](https://stackoverflow.com/questions/39015340/fuzzy-strings-matching-algorithms-for-product-titles)

---

### 3. Embedding search for semantics

To handle “foods not on the registry” or vague phrasings, add an embedding layer:

- Pre‑compute an embedding for each registry item:
  - Embed something like `"boiled root vegetables peeled soft low fiber"` or a concatenation of `canonicalName + tags`. [arxiv](https://arxiv.org/html/2603.09704v1)
- Store that vector in Convex (`Vector`/`Float32Array` field) and index it.
- When a user logs `"baby carrots and parsnips, boiled"`, embed that phrase and do approximate nearest‑neighbour search over the vectors. [pmc.ncbi.nlm.nih](https://pmc.ncbi.nlm.nih.gov/articles/PMC11957177/)

Combine fuzzy + embedding:

- If **both** say “boiled root veg” with high similarity → auto‑map.
- If fuzzy is weak but embedding strongly points to a group → still map, but maybe mark as “low confidence” for subtle UI (e.g. small dot icon).
- If both are weak → treat as unknown → fall back to user intervention/custom mapping.

Research using RAG‑style LLM + retrieval for foods (e.g., NutriRAG) shows this kind of hybrid dramatically improves mapping free‑text meals to database codes vs rules alone. [arxiv](https://arxiv.org/html/2603.09704v1)

---

## Handling foods not on the registry (your current pain point)

When “matching foods not on the registry”:

1. **Try group‑level matching first**
   - Even if you don’t have `"boiled parsnips"` explicitly, your group `"boiled_root_veg"` can accept it.
   - You log the item as:
     - `loggedName: "boiled parsnips"`
     - `mappedGroup: "boiled_root_veg"`
     - `mappedCanonical: null` (no exact canonical food yet).

2. **Auto‑create synonyms / aliases**
   - If the user confirms that mapping once, create a small alias document:
     - `aliasText: "boiled parsnips"`
     - `targetId: <boiled_root_veg>`
     - `userId: <user>` or `global: true`
   - Add `aliasText` into the Fuse.js index and into the embedding corpus, so next time it’s auto‑matched.

3. **Fallback UI when nothing fits**
   - Show: “I couldn’t find a good match for `X`. What is it closest to?” + 4–6 chips for your big buckets: `Boiled veg`, `Grilled meat`, `Sweet snack`, `Savoury snack`, `Custom/Other`.
   - Once they tap, you store that mapping as an alias; you never ask again. [tanzhou](https://www.tanzhou.space/project/accessibility-design-food-journaling-through-conversational-agent/)

4. **Log as “unmapped” but still useful**
   - If they skip mapping, still store the string and allow it to appear in their history, but don’t try to tie it to zone/metadata.
   - You can later provide a “Clean up unmapped foods” screen to batch‑map them.

This pattern is exactly what COCO Nutritionist and other food‑logging systems do: automatic mapping to codes + rare human corrections. [sciencedirect](https://www.sciencedirect.com/science/article/pii/S2475299123151687)

---

## LLM involvement: where it helps and where it’s overkill

LLMs are overkill for _every_ input, but great for edge cases: [private-ai](https://www.private-ai.com/en/blog/1412)

**Good use‑cases:**

- Parsing one messy utterance into food items:
  - `"Big bowl of chicken noodle soup, some bread with butter, and a handful of crisps"` → structured list with quantities and prep (“boiled soup”, “white bread + butter”, “potato crisps”). [jmir](https://www.jmir.org/2021/12/e26988/)
- Disambiguating when you have 2–3 close matches:
  - Prompt the LLM with:
    - the user phrase
    - the top N candidate registry entries (names + meta)
    - ask: “Which is most appropriate? If none apply, reply ‘none’.”

**Avoid LLM for:**

- Simple spelling differences, pluralisation, accents → fuzzy + embeddings are cheaper and enough. [stackoverflow](https://stackoverflow.com/questions/39015340/fuzzy-strings-matching-algorithms-for-product-titles)
- Exact numeric parsing (grams/cups) → regex/hand‑rolled parsing is clearer and more reliable. [ml6](https://www.ml6.eu/en/blog/hybrid-machine-learning-marrying-nlp-and-regex)

LLM calls then become an **exception path**, not the default. That keeps costs and latency down and makes the system feel snappy.

---

## UX / UI patterns that reduce friction

### 1. Single free‑text field + smart confirmation

In your Vite/React client:

- Main control: “What did you eat?” text box.
- Under it, as soon as they submit, show parsed items:
  - “Logged as:”
    - Chip list: `Boiled root veg → boiled carrots`, `Soft white bread`, `Plain yoghurt`
    - Each chip clickable to “Change” or “Remove”.

- Changes use a bottom sheet:
  - “I thought this was: [Boiled root veg]. Choose another type:”
  - Show grouped suggestions + a tiny search field using Fuse.js over registry.

This is the same design language that voice‑first journaling and conversational food apps use: quick confirmation, not a huge form. [dribbble](https://dribbble.com/shots/27088029-AI-Voice-Nutrition-Coach-App-VUI-Mobile-UI-Design)

### 2. Meal templates and shortcuts

Given your transit‑map metaphor, you can add:

- “Save as template”: if they often log “breakfast: toast + butter + yoghurt + coffee”, they can single‑tap it next time. [tanzhou](https://www.tanzhou.space/project/accessibility-design-food-journaling-through-conversational-agent/)
- Voice or text trigger like “log my usual breakfast” → resolves to that template.

### 3. Visual feedback tied to zones

Once items are mapped, show:

- Zone chip per row (`Z1`, `Z2`, `Z3`) with colour.
- Macro icon (C/P/F) and maybe a “risk” glyph if gas‑producing or high residue.

That helps users trust the automatic mapping even if they never fully look at the registry.

---

## Voice input: how to wire it in

Evidence from COCO Nutritionist and other projects shows spoken logging is feasible and acceptable; speech understanding + automatic code mapping works pretty well in practice. [ceur-ws](https://ceur-ws.org/Vol-4053/paper14.pdf)

**Implementation strategy:**

1. **Speech‑to‑text layer**
   - Client‑side: Web Speech API for quick prototyping (Chrome/Android), but quality/availability varies.
   - Better: call a dedicated STT (e.g. Whisper API) from your Convex function; the React app just streams audio or sends a small recording blob. [digitalhealthcrc](https://digitalhealthcrc.com/big-thinkers/transforming-food-logging-with-ai-streamlining-dietary-tracking-for-better-health-outcomes-with-vineeth-ramesh/)

2. **Same NLP pipeline as text**
   - Treat recognized text exactly like manual text log → pre‑process → fuzzy + embeddings → LLM fallback if needed.

3. **Minimal conversational framing**
   - Simple prompt: “Tap and say: ‘Log lunch: grilled chicken, mashed potatoes, boiled carrots’.” [dribbble](https://dribbble.com/shots/27088029-AI-Voice-Nutrition-Coach-App-VUI-Mobile-UI-Design)
   - Play short confirmation TTS or on‑screen list:
     - “Logged: grilled chicken (Zone 2), mashed potatoes (Zone 1), boiled carrots (Zone 2).”
   - Let the user tap to correct if something is clearly wrong.

4. **Robustness notes**

- STT will mangle brand names and foreign terms (“Quelitas”), but fuzzy search + embeddings can still pull them towards the right group. [logmeal](https://logmeal.com/api/multi-language-support/)
- For recurring mis‑recognitions, store user‑specific aliases from the _spoken_ transcript to the right registry id.

---

## Concrete Convex + React shape

**Data in Convex:**

- `foods` collection: canonical items & groups:
  - `{ _id, canonicalName, groupKey, zone, macro, metadata, examples: string[], embedding: number[] }`
- `aliases` collection:
  - `{ _id, aliasText, foodId, userId?, createdAt }`

**Client flow (React/Vite):**

1. User types or speaks → you get `rawText`.
2. Call Convex function `parseAndMatchMeal(rawText)`:
   - apply regex pre‑processing + splitting
   - fuzzy search over `foods` + `aliases` + embedding search
   - maybe one LLM call when needed
   - return `[{ rawItem, matchedFoodId, groupKey, confidence, zone, macro, metadata }]`.
3. Render those as rows with a small “Change” dropdown that calls `searchFoods(query)` (Fuse in client or a Convex search function).
4. When user confirms, write a `meal_log` and, if they changed a mapping, optionally write a new `alias`.

This directly addresses your current issue: **foods not on the registry become an opportunity to grow your alias table**, not a failure state.

---

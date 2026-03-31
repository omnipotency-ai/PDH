# Food Registry Audit — Consolidated Findings

**Date:** 2026-03-20
**File:** `shared/foodRegistry.ts`
**Scope:** All 4 zones (124 entries total: 4 × 1A, 27 × 1B, 49 × 2, 44 × 3)

---

## 1. Confirmed Correct

### Zone 1A (2 of 4)

- `clear broth` — meat_fish
- `protein drink` — eggs_dairy _(minor metadata fixes needed, see §2)_

### Zone 1B (15 of 27)

- `boiled fish` — meat_fish
- `boiled white meat` — meat_fish
- `egg` — eggs_dairy
- `cottage cheese` — eggs_dairy
- `white rice` — grains
- `white pasta` — grains
- `noodles` — grains
- `mashed potato` — vegetables
- `ripe banana` — fruit
- `stewed apple` — fruit
- `canned pear` — fruit
- `canned peach` — fruit
- `salt` — sauces_condiments
- `soft couscous` — grains
- `soft polenta` — grains

### Zone 2 (40 of 49)

- `grilled white meat`, `cooked fish`, `lean minced meat`, `red meat`, `oily fish` — meat_fish
- `buttered scrambled eggs`, `flavoured yogurt`, `milk pudding` — eggs_dairy
- `tofu` — vegetable_protein
- `crispy cracker`, `plain biscuit`, `low-fiber cereal`, `basic savoury snack`, `cornflour`, `plain flour` — grains
- `boiled carrot`, `baked potato`, `sweet potato`, `cooked pumpkin`, `courgette`, `cooked spinach`, `cooked tomato`, `swede`, `parsnip` — vegetables
- `melon`, `ripe mango` — fruit
- `vegetable oil` — oils
- `butter`, `cream cheese`, `hard cheese`, `cream`, `plain ice cream` — dairy_fats
- `avocado`, `smooth nut butter` — nuts_seeds
- `soy sauce`, `smooth tomato sauce`, `white sauce`, `gravy` — sauces_condiments
- `mild herb`, `mild spice` — herbs_spices

### Zone 3 (28 of 44)

- `fast food burger`, `processed meat`, `battered fish` — meat_fish
- `legumes` — vegetable_protein
- `wholegrain bread`, `brown rice` — grains
- `roasted potato`, `broccoli`, `green beans`, `leek`, `onion`, `sweetcorn`, `raw salad`, `mushrooms` — vegetables
- `kiwi`, `pineapple`, `strawberries`, `dried fruit`, `raw apple` — fruit canonical shouyld be apple vs peeled or stewed for zones 1-2
- `deep fried food` — oils
- `soft rind cheese`, `double cream` — dairy_fats
- `nuts`, `seeds` — nuts_seeds
- `hot sauce` — sauces_condiments
- `garlic`, `chili`, `hot spice blend` — herbs_spices

---

## 2. Needs Fix

### Zone 1A

| #   | Entry             | Issue                                                                                                 | Fix                                                               |
| --- | ----------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| F1  | `gelatin dessert` | lineOrder 12 is after all Zone 1B entries on eggs_dairy. Zone 1A must precede 1B.                     | Change lineOrder to 0                                             |
| F2  | `gelatin dessert` | `category: "protein"`, `macros: ["protein"]` — gelatin desserts are primarily sugar/carb, not protein | Change category to `"carbohydrate"`, macros to `["carbohydrate"]` |
| F3  | `gelatin dessert` | Example "fruit jelly" collides with Zone 2 "fruit jelly sweets" in `low-fiber sweet snack`            | Remove "fruit jelly" from examples                                |
| F4  | `smooth soup`     | `macros: ["carbohydrate"]` but cream-of soups contain dairy fat                                       | Update macros to `["carbohydrate", "fat"]`                        |
| F5  | `protein drink`   | lineOrder 6 is after Zone 1B entries on eggs_dairy (yogurt=1, egg=2, milk=3)                          | Change lineOrder to 0 or 1                                        |
| F6  | `protein drink`   | `fiberInsolubleLevel: "low"`, `fiberSolubleLevel: "low"` but `fiberTotalApproxG: 0`                   | Change both fiber levels to `"none"`                              |

### Zone 1B

| #   | Entry                   | Issue                                                                                                                    | Fix                                                                                             |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| F7  | `toast`                 | Examples include "toast with butter", "buttered toast" — but butter is Zone 2                                            | Remove buttered toast examples                                                                  |
| F8  | `white bread`           | "brioche" is enriched bread (high butter/egg), not plain white bread                                                     | Remove "brioche" from examples                                                                  |
| F9  | `white bread`           | "bagel" is significantly denser than soft white bread                                                                    | Move "bagel", "toasted bagel" to Zone 2                                                         |
| F10 | `rice cracker`          | "savoury cracker" example is too generic, collides with Zone 2 `crispy cracker`                                          | Rename to "savoury rice cracker"                                    |
| F11 | `rice cracker`          | "corn cake" is not a rice cracker (different grain)                                                                      | Remove "corn cake"                                   |
| F12 | `mashed root vegetable` | Examples include intact cooked pieces ("steamed pumpkin", "boiled pumpkin") that aren't mashed/pureed — these are Zone 2 | Move non-pureed examples to Zone 2 `cooked pumpkin`. Remove bare "butternut squash" (ambiguous) |

### Zone 2

| #   | Entry                    | Issue                                                                                                                   | Fix                                                            |
| --- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| F13 | `roast ham`              | Examples include "boiled ham" — different preparation, possibly Zone 1B                                                 | Rename canonical to "ham" (preparation-neutral)                |
| F14 | `mild mustard`           | "wholegrain mustard" in examples — seeds make it Zone 3                                                                 | Remove "wholegrain mustard" from examples                      |
| F15 | `simple chocolate snack` | Missing common examples ("chocolate bar", "kit kat"); bare "chocolate" routes to Zone 3 `refined confectionery` instead | Add common examples                                            |
| F16 | `low-fiber sweet snack`  | Missing common examples (jelly babies, wine gums, haribo, meringue)                                                     | Add examples                                                   |
| F17 | `peeled cucumber`        | Raw vegetable in Zone 2 contradicts "no raw salads" guidance                                                            | Add prominent note explaining the exception |
| F18 | `cooked bell pepper`     | Bare "bell pepper" example is ambiguous (could be raw = Zone 3)                                                         | Remove bare "bell pepper", keep only cooked variants           |
| F19 | `cauliflower`            | No gas metadata despite notes saying it's gassy                                                | add `gasProducing: "yes"`      |
| F20 | `peeled apple`           | lineOrder 14 is interspersed between Zone 3 fruits (7-13, 15). Zone 2 should precede Zone 3.                            | Move lineOrder to ~6 (after ripe mango)                        |

### Zone 3

| #   | Entry                   | Issue                                                                                              | Fix                                                                 |
| --- | ----------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| F21 | `guacamole`             | Defined inside the ZONE_2 array but has `zone: 3`                                                  | Move to ZONE_3 array                                                |
| F22 | `chili con carne`       | `subcategory: "processed"` — it's a complex spicy dish with meat and beans                             | Change to `"meat, legumes, spicy"`                                                  |
| F23 | `stir fry`              | `subcategory: "processed"` — it's a cooking method, not processed                                  | Change to `"meat, vegetables, fried"`                                                  |
| F24 | `curry dish`            | `subcategory: "processed"` — same issue                                                            | Change to `"meat, vegetables, spicy"`                                                  |
| F25 | `dark chocolate`        | `group: "seasoning"`, `line: "sauces_condiments"` — chocolate is not a sauce/condiment             | Consider moving to `group: "carbs"`, `line: "grains"` this one is tricky maybe should go to dairy fats or carbs sugar               |
| F26 | `refined confectionery` | Same issue — cake, doughnut, croissant on sauces_condiments line                                   | Consider moving to `group: "carbs"`, `line: "grains"`               |
| F27 | `stevia`                | Canonical "stevia" but examples include aspartame, sucralose, saccharin — all chemically different | Rename canonical to "artificial sweetener" or "non-sugar sweetener" |
| F28 | `miso soup`             | `macros: []` is incorrect — contains protein + carbs from soy/koji                                 | Change to `macros: ["protein", "carbohydrate"]`                     |
| F29 | `hot sauce`             | Missing notes field (only Zone 3 seasoning without notes)                                          | Add notes about capsaicin as GI irritant                            |
| F30 | `fried egg`             | Zone 3 is too aggressive — buttered scrambled eggs are Zone 2, frying uses similar fat             | Move to Zone 2                                                      |

---

## 3. Needs User Review

### Zone 1A

> **R1.** `smooth soup` — Is this truly Zone 1A? Clear liquid diets are transparent liquids only. Smooth/pureed soup is a "full liquid" (opaque). The file header says Zone 1A = "Clear and full liquids" which includes it, but this conflates two clinically distinct phases. Should 1A be split, or does smooth soup stay?
>
> _Agent recommendation: Keep, but ensure lineOrder is higher than clear broth (currently both are 1 — smooth soup should be 2+)._

> **R2.** `clear broth` — Should "vegetable stock/broth" be on the `meat_fish` line? Vegetable broth contains no meat or fish. A user logging "vegetable stock" gets classified as protein > meat_fish.
>
> _Agent recommendation: Accept the imprecision (transit map grouping matters more), or split "vegetable broth" to vegetables line._

> **R3.** `clear broth` — Examples "rice soup (broth)" and "sm bowl white rice soup (broth)" look like personal-use hard-coded entries. Remove per "No Hard-Coding Personalization" principle?
>
> _Agent recommendation: remove rice variants, these were complex meals consisting of rice and separately broth, should not map to this one canonical.._

### Zone 1B

> **R4.** `plain yogurt` — Is full-fat Greek yogurt appropriate for Zone 1B? Higher fat than regular yogurt. Most guidelines say start with low-fat.
>
> _Agent recommendation: Keep — Greek yogurt is well-tolerated and probiotic. Add note: "low-fat or standard; avoid very high-fat varieties in early reintroduction."_

> **R5.** `milk` — Zone 1B despite temporary lactose intolerance being common post-ileocecal resection. Should it be Zone 2?
>
> _Agent recommendation: Keep at 1B, add `lactoseRisk: "moderate"` metadata._

> **R6.** `olive oil` — Only pure fat in Zone 1B. Butter was explicitly moved to Zone 2. Is olive oil genuinely safer than butter here?
>
> _Agent recommendation: Keep — monounsaturated fat in cooking amounts is milder than saturated dairy fat._

> **R7.** `porridge` — Oats have ~1.5-2g fiber/serving, at the upper boundary of 1B's <2g limit. Gas-producing beta-glucan. Should this be early Zone 2?
>
> _Agent recommendation: Keep at 1B — commonly recommended by UK clinical teams. Add digestion metadata._

> **R8.** `soaked cracker` — Is this a real food people log? Very specific preparation. Could be absorbed into toast/white bread.
>
> _Agent recommendation: remove, this is a rare preparation and not a food in itself._

> **R9.** `garnish herb` — Canonical name is jargon. Users would log "parsley" or "fresh dill", not "garnish herb". Does the canonical appear in the UI?
>
> _Agent recommendation: If shown on transit map, rename to "fresh herbs". If internal-only, keep._ should map to mild herbs surely

> **R10.** `custard` — `subcategory: "dessert"` but on `eggs_dairy` line. Is this the intended transit map grouping (alongside eggs and cottage cheese)?
>
> _Agent recommendation: Likely intentional. Just confirming._

### Zone 2

> **R11.** `mild veggie burger` — Zone 2 for a processed food? Commercial versions often contain onion, garlic, high-fiber legumes (making them Zone 3). Only homemade potato/rice/tofu patties are gentle enough.
>
> _Agent recommendation: Move to zone 3, these are processed foods and should be treated as such._

> **R12.** `cooked spinach` — Zone 2 or 3? Oxalate content can cause loose stools. Most NHS low-residue guides allow it.
>
> _Agent recommendation: Keep at Zone 2. Add digestion metadata._

> **R13.** `honey` and `jam` — Zone 2, but concentrated fructose/sugar has osmotic effects. Post-anastomosis patients with high output may struggle. Should these be Zone 3? late zone 2
>
> _Agent recommendation: Keep at Zone 2 (condiment portions). Add osmoticEffect metadata._

> **R14.** `black pepper` — Zone recently changed from 3 to 2. Example includes "lots of pepper" which could be irritating. Correct?
>
> _Agent recommendation: Keep at Zone 2. Remove "lots of pepper" from examples._ move back to zone 3, i am still not using it and i am already trying zone 3 foods in my diet but dont want to risk a burning sensation on exit

> **R15.** `mild cheese snack` — Only 3 examples. Overlaps with `basic savoury snack` and `hard cheese`. Should it be merged?
>
> _Agent recommendation: merge with basic savoury snack, these are not distinct enough._

### Zone 3

> **R16.** `kefir` — Zone 3 for fermented dairy, but GI specialists often recommend it post-surgery. Could be Zone 2 for patients who tolerate yogurt. yes
>
> _Agent recommendation: Keep at Zone 2 with warnings for now — fermented foods are unpredictable post-anastomosis._

> **R17.** `mandarin` — Zone 3 for all citrus, but "canned mandarin" (in syrup) is much milder. Should canned mandarin be Zone 2 (like canned peach is Zone 1B)?
>
> _Agent recommendation: Consider splitting canned mandarin to Zone 2._
yes
> **R18.** `orange` — Includes grapefruit, pomelo, lime as examples. Lime is used as a condiment, not eaten as fruit. Grapefruit has drug interaction risks. Should these be separate entries? rename canonical to citrus fruits
>
> _Agent recommendation: Split lime out at minimum. Rename canonical to "citrus fruit" if grapefruit stays._ ok

> **R19.** `exotic fruit` — Bundles papaya, dragon fruit, passion fruit, fig, pomegranate, etc. Fig (high fiber/seeds) and pomegranate (seeds) are very different from lychee (soft, low-fiber). Too broad?
>
> _Agent recommendation: Split fig and pomegranate into own entries. Rest can stay bundled._

> **R20.** `pizza` — On `grains` line (because dough is dominant weight). Could be on `meat_fish` alongside fast food burger. Correct line?
>
> _Agent recommendation: Keep on grains — defensible._

> **R21.** `high-sugar refined snack` — Generic name but only Biscoff examples. Should this be `"biscoff"` or get broader examples?
>
> _Agent recommendation: Add broader examples (rice krispie treats, pop tarts, granola bars, flapjacks) or rename._

> **R22.** `sweet biscuit` vs `high-sugar refined snack` — Unclear boundary. Both are sugary baked items on grains line at lineOrders 24-25. Merge?
>
> _Agent recommendation: Clarify distinction in notes._

---

## 4. Missing Foods

### Critical Gaps (missing from entire registry)

| #   | Food                            | Suggested Zone | Rationale                                                               |
| --- | ------------------------------- | -------------- | ----------------------------------------------------------------------- |
| M1  | **Tea (plain/weak)**            | 1A             | Universally allowed on clear liquid diets. Extremely common input.      |
| M2  | **Coffee (black/decaf)**        | 3              | Stimulates colonic motility. Patients always ask.    add warning will need tradeoff                   |
| M3  | **Diluted juice / clear juice** | 1A             | Clear apple juice, diluted squash — standard clear liquid items.        |
| M4  | **Electrolyte drink / ORS**     | 1A             | Dioralyte, Pedialyte — essential post-surgical recovery.                |
| M5  | **Alcohol (beer/wine/spirits)** | 3              | Completely absent. GI irritant, increases output. Very common question. |
| M6  | **Carbonated drinks**           | 3              | Coke, lemonade, sparkling water — gas, sugar, carbonation.              |
| M7  | **Plant milk (oat/almond/soy)** | 2              | Very common dairy alternative. No entry at any zone.                    |
| M8  | **Water**                       | 1A             | Most fundamental intake. No registry match if user types "water".       |

### Zone-Specific Gaps

| #   | Food                            | Zone    | Rationale                                                                 |
| --- | ------------------------------- | ------- | ------------------------------------------------------------------------- |
| M9  | Ice lolly / popsicle            | 1A      | Standard clear liquid diet item. Frozen juice.                            |
| M10 | Smooth mousse / whipped dessert | 1B      | Bridge between liquid jelly (1A) and custard (1B).                        |
| M11 | Plain boiled potatoes           | 2 | Mashed=1B, baked=2, but plain boiled has no match.                        |
| M12 | Mashed sweet potato             | 1B      | Mashed regular potato is 1B; mashed sweet potato is absent.               |
| M13 | Pancake / crepe (plain)         | 2       | Cooked batter = flour + egg + milk. Common, no entry.                     |
| M14 | Mozzarella / soft fresh cheese  | 2       | Distinct from cream cheese and hard cheese.                               |
| M15 | Cooked beetroot                 | 2       | Common NHS low-residue vegetable.                                         |
| M16 | Semolina                        | 1b | Refined wheat pudding, common in UK/European recovery diets.              |
| M17 | Lemon juice       lime              | 2       | Condiment-quantity citrus. Common flavoring.                              |
| M18 | Wholemeal pasta            no     | 3       | White pasta notes say "no wholemeal (Zone 3)" but no Zone 3 entry exists. |
| M19 | Raw pear    no                    | 3       | Raw apple exists at Zone 3, but raw pear is missing.                      |
| M20 | Grapes                          | 2   | Common fruit, not in registry at all.                                     |
| M21 | Cabbage (cooked)       no         | 3       | Cruciferous, like broccoli. Absent.                                       |
| M22 | Brussels sprouts       no         | 3       | Cruciferous. Absent.                                                      |
| M23 | Coconut                 yes        | 3       | High fat/fiber. Common in curries and baked goods.                        |
| M24 | Bran/high-fiber cereal    no      | 3       | Low-fiber cereal notes mention "no bran" but no Zone 3 entry.             |
| M25 | Asparagus                 no      | 2 or 3  | Fibrous vegetable. Common.                                                |

---

## 5. Candidate Removals

| #   | Entry                      | Zone | Rationale                                                                     |
| --- | -------------------------- | ---- | ----------------------------------------------------------------------------- |
| C1  | `cornflour`          ok      | 2    | Nobody logs "I ate cornflour" — it's an ingredient in sauces already covered. |
| C2  | `plain flour`        ok      | 2    | Same — ingredient, not a food.                                                |
| C3  | `high-sugar refined snack`sweet biscuit should have choicolate biscuits, choc cjhip cookies, jammie dodgers, mikado, coconut cream, anything thats not a plain digestive or a rich tea or a shortbread, whereas tghe other should have patries, confectionery, high sugar snacks, flapjacks, pop tarts, rice krispie treats, | 3    | Overlaps with `sweet biscuit`, only has Biscoff examples. Consider merging.   |
| C4  | `miso soup`          ok      | 3    | Niche. Could be covered by note on `clear broth`.                             |

---

## 6. Structural Issues

### Sauces/Condiments line has become a dumping ground

Dark chocolate, refined confectionery (cake, doughnut, croissant), stevia, and miso soup all sit on `sauces_condiments` despite not being sauces or condiments. The transit map will show chocolate cake next to soy sauce.

**Recommendation:** Move sweets/confectionery to `grains` line. Move miso soup to `vegetables` line. ok

### `subcategory: "processed"` is overused

Used for both genuinely processed foods (sausage, bacon) AND cooked dishes (chili con carne, stir fry, curry). These are different things.

**Recommendation:** Introduce `"composite_dish"`.

### Zone 3 digestion metadata is sparse

Only 6 of 44 Zone 3 entries have metadata. The remaining 37 have none. Metadata is needed for transit correlation and Dr. Poo. zone 3 is the least important zone, so this is not a high priority. and we need to do massive grouping for zone 3, all spicy food, all deep fried or shallow fried food, all fruits ans vegetables notr mentioned in previous zones, etc., all high fibre, all high fat, all high sugar, all high salt, all high spice, all high alcohol, all high caffeine, etc.

### lineOrder violations

Zone 1A entries should have lower lineOrders than Zone 1B entries on the same line. Currently `gelatin dessert` (1A) is at 12 and `protein drink` (1A) is at 6, both after 1B entries.  True, but is it possible to have the same line number so that some foods are equally in line, so you'd have line order one, line order two, Then line order 3, 3, 3, 3, 3, then line order 4, then line order 5, 5, 5, then line order order 6, line Line order seven seven, line order eight, 9, 9, 9, 9, 9, 9, 9. line order 10, 10, 10, 10, 10, 10, 10, 10, 10. Line order 11, 11. and I know the twelve twelve, twelve 

Similarly, Zone 2 `peeled apple` at lineOrder 14 is interspersed between Zone 3 fruits (7-13 and 15).

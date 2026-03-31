# Food Registry — Restructured Tables

---

## meat_fish (Protein) — restructured

| #   | Canonical          | Zone | Change                                                                    |
| --- | ------------------ | ---- | ------------------------------------------------------------------------- |
| 1   | clear broth        | 1A   | moved from hub                                                            |
| 2   | boiled fish        | 1B   | replaces steamed fish. Examples: boiled/poached white fish                |
| 3   | boiled white meat  | 1B   | replaces plain chicken. Examples: boiled/poached chicken, turkey          |
| 4   | grilled white meat | 2    | replaces grilled chicken. Examples: grilled/baked chicken, turkey         |
| 5   | cooked fish        | 2    | replaces baked fish. Examples: grilled/baked white fish                   |
| 6   | red meat           | 2    | replaces lean mince, lean pork. Examples: beef, lamb, pork (lean, cooked) |
| 7   | oily fish          | 2    | replaces salmon + tuna (combined). Examples: salmon, tuna, mackerel       |
| 8   | fast food burger   | 3    | renamed from "fast food". Examples: Big Mac, burger meal, cheeseburger    |
| 9   | processed meat     | 3    | absorbs ham. Examples: sausage, bacon, ham, salami, chorizo               |
| 10  | battered fish      | 3    | new. Examples: fish and chips, deep fried fish, fish in batter            |
| 11  | chili con carne    | 3    | unchanged                                                                 |
| 12  | curry dish         | 3    | renamed from "takeaway curry". Examples: tikka masala, korma, Thai curry  |

**Removed entries:** plain chicken, steamed fish, grilled chicken, turkey, lean mince, ham, lean pork, salmon, tuna, baked fish, fast food, takeaway curry

---

## eggs_dairy (Protein)

| #   | Canonical      | Zone | Change                                   |
| --- | -------------- | ---- | ---------------------------------------- |
| 1   | plain yogurt   | 1B   | unchanged                                |
| 2   | egg            | 1B   | unchanged                                |
| 3   | milk           | 1B   | moved from hub                           |
| 4   | cottage cheese | 1B   | unchanged                                |
| 5   | kefir          | 3    | new entry (caused bad diarrhea)          |
| 6   | fried egg      | 3    | zone changed from 1B (fried = added fat) |

---

## vegetable_protein (Protein)

| #   | Canonical | Zone | Change                         |
| --- | --------- | ---- | ------------------------------ |
| 1   | legumes   | 3    | unchanged (only entry for now) |

---

## grains (Carbs)

| #   | Canonical                   | Zone | Change                                                                                                                    |
| --- | --------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------- |
| 1   | white rice                  | 1B   | unchanged                                                                                                                 |
| 2   | toast                       | 1B   | unchanged                                                                                                                 |
| 3   | plain cracker               | 1B   | unchanged                                                                                                                 |
| 4   | white bread                 | 1B   | unchanged                                                                                                                 |
| 5   | white pasta                 | 1B   | zone changed from 2 (per clinical check: well-cooked white pasta is low-residue, same category as white bread/rice)       |
| 6   | rice cracker                | 1B   | zone changed from 2 (same as plain cracker/rice cake)                                                                     |
| 7   | porridge                    | 1B   | unchanged (clinical check: smooth porridge is standard low-residue, NHS/UCSF list cooked cereals as early reintroduction) |
| 8   | cornflour                   | 2    | unchanged                                                                                                                 |
| 9   | plain flour                 | 2    | unchanged                                                                                                                 |
| 10  | pizza                       | 3    | unchanged                                                                                                                 |
| 11  | wholegrain bread            | 3    | unchanged                                                                                                                 |
| 12  | brown rice                  | 3    | unchanged                                                                                                                 |
| 13  | concentrated sweet food     | 3    | unchanged (includes pastries, cakes — noted for future expansion)                                                         |
| 14  | sugary drink `´´´remove´´´` | 3    | moved from condiment to carbs/grains (it's sugar, not a condiment)                                                        |

---

## vegetables (Carbs) — restructured around preparation

| #   | Canonical             | Zone | Change                                                                                                                                                     |
| --- | --------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | smooth soup           | 1A   | moved from hub. Pureed vegetable soup.                                                                                                                     |
| 2   | mashed potato         | 1B   | unchanged (pureed/mashed potato only)                                                                                                                      |
| 3   | mashed root vegetable | 1B   | replaces "cooked carrot" + "cooked pumpkin". Examples: pureed carrot, mashed carrot, pureed parsnip, pureed swede, pureed pumpkin, mashed butternut squash |
| 4   | boiled carrot         | 2    | new — Zone 2 preparation of carrot (boiled, not pureed)                                                                                                    |
| 5   | baked potato          | 2    | moved from grain. Flesh only, no skin.                                                                                                                     |
| 6   | sweet potato          | 2    | moved from grain. Boiled/baked, peeled.                                                                                                                    |
| 7   | cooked pumpkin        | 2    | boiled/baked pumpkin (not pureed — pureed is under mashed root vegetable)                                                                                  |
| 8   | courgette             | 2    | unchanged                                                                                                                                                  |
| 9   | peeled cucumber       | 2    | unchanged                                                                                                                                                  |
| 10  | cooked spinach        | 2    | unchanged                                                                                                                                                  |
| 11  | cooked tomato         | 2    | unchanged (skinless, cooked)                                                                                                                               |
| 12  | cooked bell pepper    | 2    | unchanged                                                                                                                                                  |
| 13  | swede                 | 2    | moved earlier (user feedback)                                                                                                                              |
| 14  | parsnip               | 2    | unchanged                                                                                                                                                  |
| 15  | cauliflower           | 2    | moved to end of Zone 2 (gassy but tolerable if well-cooked)                                                                                                |
| 16  | roasted potato        | 3    | zone changed from 2 (roasted in fat)                                                                                                                       |
| 17  | broccoli              | 3    | zone changed from 2 (cruciferous, gassy, high output risk for anastomosis)                                                                                 |
| 18  | green beans           | 3    | zone changed from 2 (stringy, gassy)                                                                                                                       |
| 19  | leek                  | 3    | zone changed from 2 (basically an onion)                                                                                                                   |
| 20  | onion                 | 3    | moved from condiment                                                                                                                                       |
| 21  | sweetcorn             | 3    | unchanged                                                                                                                                                  |
| 22  | raw salad             | 3    | unchanged (raw leafy greens only — grated carrot is under pureed/boiled carrot)                                                                            |
| 23  | mushrooms             | 3    | unchanged                                                                                                                                                  |

---

## fruit (Carbs)

| #   | Canonical    | Zone | Change                                                        |
| --- | ------------ | ---- | ------------------------------------------------------------- |
| 1   | ripe banana  | 1B   | unchanged                                                     |
| 2   | stewed apple | 1B   | unchanged                                                     |
| 3   | canned pear  | 1B   | unchanged                                                     |
| 4   | canned peach | 1B   | zone changed from 2 (soft, in juice, very low residue)        |
| 5   | melon        | 2    | unchanged                                                     |
| 6   | ripe mango   | 2    | keeping at 2 (soft, low acid when ripe — borderline, flagged) |
| 7   | mandarin     | 3    | zone changed from 2 (citrus acid increases output)            |
| 8   | kiwi         | 3    | unchanged                                                     |
| 9   | orange       | 3    | unchanged                                                     |
| 10  | pineapple    | 3    | unchanged                                                     |
| 11  | strawberries | 3    | unchanged                                                     |
| 12  | dried fruit  | 3    | unchanged                                                     |
| 13  | exotic fruit | 3    | unchanged                                                     |

---

## oils (Fats)

| #   | Canonical       | Zone | Change    |
| --- | --------------- | ---- | --------- |
| 1   | olive oil       | 1B   | unchanged |
| 2   | vegetable oil   | 2    | unchanged |
| 3   | deep fried food | 3    | unchanged |

---

## dairy_fats (Fats)

| #   | Canonical        | Zone | Change               |
| --- | ---------------- | ---- | -------------------- |
| 1   | butter           | 2    | zone changed from 1B |
| 2   | cream cheese     | 2    | unchanged            |
| 3   | hard cheese      | 2    | unchanged            |
| 4   | cream            | 2    | unchanged            |
| 5   | plain ice cream  | 2    | unchanged            |
| 6   | soft rind cheese | 3    | unchanged            |
| 7   | double cream     | 3    | unchanged            |

---

## nuts_seeds (Fats)

| #   | Canonical         | Zone | Change                                                       |
| --- | ----------------- | ---- | ------------------------------------------------------------ |
| 1   | avocado           | 2    | moved from fruit                                             |
| 2   | smooth nut butter | 2    | new entry (peanut butter, almond butter — smooth, no chunks) |
| 3   | nuts              | 3    | unchanged                                                    |
| 4   | seeds             | 3    | unchanged                                                    |

---

## sauces_condiments (Seasoning)

| #   | Canonical           | Zone | Change    |
| --- | ------------------- | ---- | --------- |
| 1   | salt                | 1B   | unchanged |
| 2   | soy sauce           | 2    | unchanged |
| 3   | smooth tomato sauce | 2    | unchanged |
| 4   | mild mustard        | 2    | unchanged |
| 5   | white sauce         | 2    | unchanged |
| 6   | hot sauce           | 3    | unchanged |

---

## herbs_spices (Seasoning)

| #   | Canonical       | Zone | Change                                                             |
| --- | --------------- | ---- | ------------------------------------------------------------------ |
| 1   | mild fresh herb | 1B   | unchanged                                                          |
| 2   | mild herb       | 2    | unchanged                                                          |
| 3   | mild spice      | 2    | unchanged                                                          |
| 4   | black pepper    | 2    | zone changed from 3 (ground pepper is a mild spice, end of Zone 2) |
| 5   | garlic          | 3    | moved to herbs_spices                                              |
| 6   | chili           | 3    | unchanged                                                          |
| 7   | hot spice blend | 3    | unchanged                                                          |

---

## Registry Gap Audit (2026-03-15 — verified against source)

Verified actual `examples` arrays in `shared/foodRegistry.ts` (2858 lines, ~117 canonicals).

### Confirmed gaps (standalone words missing as examples)

| Word      | Should map to                 | Line      | Status                                                                                  |
| --------- | ----------------------------- | --------- | --------------------------------------------------------------------------------------- |
| `chicken` | `grilled white meat` (Zone 2) | meat_fish | **MISSING** — only compound forms like "boiled chicken", "grilled chicken breast" exist |
| `bread`   | `white bread` (Zone 1B)       | grains    | **MISSING** — only compound forms like "white bread slice", "white bread roll" exist    |

### Confirmed present (standalone words that ARE in examples)

| Word     | Maps to                                                    | Zone | Verified                             |
| -------- | ---------------------------------------------------------- | ---- | ------------------------------------ |
| `pasta`  | `white pasta`                                              | 1B   | Line 499                             |
| `beef`   | `red meat`                                                 | 2    | Line 899                             |
| `pork`   | `red meat`                                                 | 2    | Line 901                             |
| `lamb`   | `red meat`                                                 | 2    | Line 900                             |
| `turkey` | `grilled white meat`                                       | 2    | Line 852                             |
| `fish`   | Not as standalone — only "boiled fish", "plain fish", etc. | —    | Partially covered via compound forms |

### Decision for gaps

For `"chicken"`: map standalone to `"grilled white meat"` (Zone 2). Users who boil chicken will write "boiled chicken". Standalone "chicken" implies a standard cooked preparation.

For `"bread"`: map standalone to `"white bread"` (Zone 1B). This is the safest assumption and matches clinical intent.

For `"fish"` standalone: add to both `"boiled fish"` (Zone 1B) and `"cooked fish"` (Zone 2) — or pick one. Recommend `"cooked fish"` (Zone 2) as the safer default since standalone "fish" doesn't imply moist-heat only.

**These gaps are tracked as tech debt.** Fix by adding standalone words to the relevant `examples` arrays in `shared/foodRegistry.ts`.

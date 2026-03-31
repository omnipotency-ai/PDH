# Caca Traca — Transit Map Designer Brief

**Purpose:** Designer handoff for Sprint 2.7 radial SVG transit map. All station data, layout specifications, tech stack, and deliverable format.

**Source of truth:** `shared/foodRegistryData.ts` (147 canonical entries as of 2026-03-20).

---

## Summary Statistics

| Metric                     | Count |
| -------------------------- | ----- |
| Total stations in registry | 147   |
| Zone 1A stations           | 9     |
| Zone 1B stations           | 29    |
| Zone 2 stations            | 59    |
| Zone 3 stations            | 50    |

### By Group (all zones)

| Group     | Lines                                    | Total Stations |
| --------- | ---------------------------------------- | -------------- |
| Protein   | meat_fish, eggs_dairy, vegetable_protein | 27             |
| Carbs     | grains, vegetables, fruit                | 79             |
| Fats      | oils, dairy_fats, nuts_seeds             | 17             |
| Seasoning | sauces_condiments, herbs_spices          | 24             |

### By Line (all zones, sorted by total stations descending)

| Line              | Group     | 1A  | 1B  | Z2  | Z3  | Total |
| ----------------- | --------- | --- | --- | --- | --- | ----- |
| vegetables        | carbs     | 4   | 3   | 15  | 9   | 31    |
| grains            | carbs     | 1   | 12  | 8   | 9   | 30    |
| fruit             | carbs     | 2   | 4   | 5   | 10  | 21    |
| meat_fish         | protein   | 1   | 2   | 6   | 6   | 15    |
| sauces_condiments | seasoning | 0   | 1   | 8   | 3   | 12    |
| eggs_dairy        | protein   | 1   | 6   | 5   | 0   | 12    |
| herbs_spices      | seasoning | 0   | 0   | 2   | 4   | 6     |
| dairy_fats        | fats      | 0   | 0   | 6   | 2   | 8     |
| nuts_seeds        | fats      | 0   | 0   | 2   | 4   | 6     |
| vegetable_protein | protein   | 0   | 0   | 1   | 2   | 3     |
| oils              | fats      | 0   | 1   | 1   | 1   | 3     |

> Note: The sprint 2.7 plan contained an earlier station count (83 map stations + 44 Zone 3 = 127 total, with a note of 95 in the hook comment). The registry has been expanded since those notes were written. The table above reflects the actual state of `foodRegistryData.ts` as of the date of this brief. These numbers are authoritative.

---

## Section 1: Station Inventory

Stations are listed sorted by `lineOrder` within each line. `lineOrder` is the suggested introduction order — lower numbers = try earlier in recovery.

---

### Protein Corridor

#### Meat & Fish Line (`meat_fish`)

| lineOrder | Station            | Zone | Subcategory    | Notes                                                                            |
| --------- | ------------------ | ---- | -------------- | -------------------------------------------------------------------------------- |
| 1         | clear broth        | 1A   | broth          | Clear strained liquid only. No solids, cream, or blended vegetables.             |
| 2         | boiled fish        | 1B   | fish           | White fish only, moist-heat, no added fat.                                       |
| 3         | boiled white meat  | 1B   | meat           | Moist-heat only (poached, boiled, steamed). No added fat, no browning.           |
| 4         | grilled white meat | 2    | meat           | Dry-heat chicken or turkey. No skin. Distinct from Zone 1 boiled white meat.     |
| 5         | cooked fish        | 2    | fish           | White fish with small amount of butter or oil. Distinct from Zone 1 boiled fish. |
| 6         | lean minced meat   | 2    | meat           | Finely minced, well-cooked without gristle or heavy browning.                    |
| 7         | red meat           | 2    | meat           | Whole-cut or chunked red meat, well cooked. No spicy seasoning.                  |
| 8         | oily fish          | 2    | fish           | Oily fish — healthy unsaturated fat. Small portions.                             |
| 9         | ham                | 2    | meat           | Thick-cut cooked ham or ham off the bone.                                        |
| 10        | fast food burger   | 3    | composite_dish | High fat, high salt, often with garlic/onion. Full Zone 3 challenge.             |
| 11        | processed meat     | 3    | processed      | High fat, high salt, strong spicing. Sausage-style and cured meats.              |
| 12        | battered fish      | 3    | fish           | Deep fried in batter.                                                            |
| 13        | chili con carne    | 3    | composite_dish | Composite dish: meat, legumes, spicy.                                            |
| 14        | stir fry           | 3    | composite_dish | Composite dish: meat, vegetables, fried. Often includes garlic/onion.            |
| 15        | curry dish         | 3    | composite_dish | Composite dish: restaurant/takeaway curries with garlic, onion, and chili.       |

#### Eggs & Dairy Line (`eggs_dairy`)

| lineOrder | Station                 | Zone | Subcategory | Notes                                                                         |
| --------- | ----------------------- | ---- | ----------- | ----------------------------------------------------------------------------- |
| 6         | protein drink           | 1A   | milk_yogurt | Clear whey or hospital-style protein water.                                   |
| 1         | plain yogurt            | 1B   | milk_yogurt | Plain, smooth, no fruit pieces or granola. Greek yogurt included.             |
| 2         | egg                     | 1B   | egg         | Any cooked egg without added fat: boiled, poached, scrambled, plain omelette. |
| 3         | milk                    | 1B   | milk_yogurt | Includes milk drunk plain or used in tea/coffee. Track lactose tolerance.     |
| 4         | cottage cheese          | 1B   | cheese      | Soft, smooth, high protein, low fat. Easy to digest.                          |
| 5         | custard                 | 1B   | dessert     | Smooth milk-and-egg custard only. No pastry shells.                           |
| 12        | smooth mousse           | 1B   | dessert     | Smooth, aerated desserts. Bridge between gelatin (1A) and custard (1B).       |
| 7         | buttered scrambled eggs | 2    | egg         | Scrambled eggs cooked with a small amount of butter.                          |
| 8         | flavoured yogurt        | 2    | milk_yogurt | Smooth fruit-flavoured yogurt without fruit pieces or seeds.                  |
| 9         | milk pudding            | 2    | dessert     | Set milk-based desserts without fruit pieces or nuts.                         |
| 10        | kefir                   | 2    | milk_yogurt | Fermented dairy. Trial cautiously — unpredictable post-anastomosis.           |
| 11        | fried egg               | 2    | egg         | Egg cooked in added fat (butter, oil).                                        |

#### Vegetable Protein Line (`vegetable_protein`)

| lineOrder | Station            | Zone | Subcategory | Notes                                                      |
| --------- | ------------------ | ---- | ----------- | ---------------------------------------------------------- |
| 1         | tofu               | 2    | legume      | Plain tofu only. No fried, smoked, or spicy tofu dishes.   |
| 3         | legumes            | 3    | legume      | Blockage risk and high gas/wind flagged in all guidelines. |
| 4         | mild veggie burger | 3    | processed   | Soft non-bean patty built from potato, rice, or tofu.      |

---

### Carbs Corridor

#### Grains Line (`grains`)

| lineOrder | Station                  | Zone | Subcategory    | Notes                                                                                   |
| --------- | ------------------------ | ---- | -------------- | --------------------------------------------------------------------------------------- |
| 0         | gelatin dessert          | 1A   | dessert        | Smooth gelatin dessert only. No fruit pieces, seeds, cream.                             |
| 2         | white rice               | 1B   | grain          | Well-cooked, plain. Any white rice variety. Congee counts here.                         |
| 3         | toast                    | 1B   | grain          | BRAT-diet staple. Toasting makes it easier to digest than soft bread.                   |
| 4         | soaked cracker           | 1B   | grain          | Zone 1 cracker only: softened in broth or soup until no longer dry.                     |
| 5         | white bread              | 1B   | grain          | Soft white bread. No seeds, grains, or added fibre.                                     |
| 6         | white pasta              | 1B   | grain          | White/refined pasta only, well-cooked.                                                  |
| 7         | noodles                  | 1B   | grain          | Plain refined noodles only, well-cooked and not fried.                                  |
| 8         | rice cracker             | 1B   | grain          | Light crackers. Low residue, easy to digest.                                            |
| 9         | porridge                 | 1B   | grain          | Smooth, plain, no added seeds or dried fruit.                                           |
| 10        | rice pudding             | 1B   | dessert        | Soft rice cooked in milk. No dried fruit, nuts, or seeds.                               |
| 11        | soft couscous            | 1B   | grain          | Plain, fine couscous cooked very soft. No herbs, seeds, or vegetables.                  |
| 12        | soft polenta             | 1B   | grain          | Plain, fine polenta cooked until spoon-soft. No cheese or herbs.                        |
| 19        | semolina                 | 1B   | grain          | Refined wheat product, very gentle. Common in UK post-surgical recovery.                |
| 13        | crispy cracker           | 2    | grain          | Thin, crispy refined crackers and breadsticks. Low fibre, notably dry.                  |
| 14        | plain biscuit            | 2    | processed      | Plain, low-fibre tea biscuits such as Maria biscuits.                                   |
| 15        | low-fiber cereal         | 2    | grain          | Refined breakfast cereals without nuts, seeds, or bran.                                 |
| 16        | basic savoury snack      | 2    | processed      | Plain savoury snacks (plain crisps, pretzels, cheese puffs). Low fibre, dry.            |
| 17        | low-fiber sweet snack    | 2    | sugar          | Low-residue sweets (gummy bears, marshmallows, meringue). Main risk: osmotic looseness. |
| 18        | simple chocolate snack   | 2    | sugar          | Plain chocolate bar or simple chocolate biscuit. Small portions only.                   |
| 20        | plain pancake            | 2    | grain          | Plain pancake/crepe made from white flour, egg, milk. No rich fillings.                 |
| 28        | bagel                    | 2    | grain          | Denser than soft white bread. Plain/white only.                                         |
| 21        | pizza                    | 3    | composite_dish | High fat, often contains garlic, onion, and spiced toppings.                            |
| 22        | wholegrain bread         | 3    | grain          | High insoluble fibre. Includes sourdough, rye, seeded bread.                            |
| 23        | brown rice               | 3    | grain          | Higher fibre than white rice. Includes quinoa and bulgur.                               |
| 24        | sweet biscuit            | 3    | processed      | Sweeter or richer biscuits and cookies (Oreo, custard cream, ginger nut).               |
| 25        | high-sugar refined snack | 3    | processed      | Highly refined, sugary snack foods (Biscoff, pastries, flapjacks).                      |
| 26        | dark chocolate           | 3    | sugar          | Separate from generic confectionery — lower sugar load but still Zone 3.                |
| 27        | refined confectionery    | 3    | sugar          | Concentrated fructose and sugar (cake, croissant, sweets, candy).                       |
| 29        | alcohol                  | 3    | alcohol        | GI irritant that increases output and dehydrates.                                       |
| 30        | carbonated drink         | 3    | fizzy_drink    | Gas from carbonation causes bloating. Sugar + artificial sweetener risks.               |

#### Vegetables Line (`vegetables`)

| lineOrder | Station               | Zone | Subcategory       | Notes                                                                                     |
| --------- | --------------------- | ---- | ----------------- | ----------------------------------------------------------------------------------------- |
| 0         | smooth soup           | 1A   | broth             | Fully blended and strained. No chunks, seeds, or high-fat cream.                          |
| 1         | water                 | 1A   | water             | Most fundamental intake. Sparkling water may cause gas.                                   |
| 24        | tea                   | 1A   | hot_drink         | Weak/plain tea without milk. Herbal teas recommended for post-surgical comfort.           |
| 25        | electrolyte drink     | 1A   | supplement        | Essential for post-surgical hydration. Osmotic effect can be moderate.                    |
| 2         | mashed potato         | 1B   | vegetable         | Peeled, well-cooked, mashed smooth. Small amount of butter or milk is fine.               |
| 3         | mashed root vegetable | 1B   | vegetable         | Peeled, well-cooked, pureed or mashed (carrot, parsnip, pumpkin, squash).                 |
| 26        | mashed sweet potato   | 1B   | root_vegetable    | Peeled and mashed/pureed sweet potato. As gentle as regular mashed potato.                |
| 4         | boiled carrot         | 2    | vegetable         | Boiled, not pureed. Distinct from Zone 1B mashed root vegetable.                          |
| 5         | baked potato          | 2    | vegetable         | Flesh only — no skin (Zone 3). Skin holds significant fibre.                              |
| 6         | sweet potato          | 2    | vegetable         | Peeled, well-cooked. No skin.                                                             |
| 7         | cooked pumpkin        | 2    | vegetable         | Boiled/baked pumpkin (not pureed — pureed is Zone 1B).                                    |
| 8         | courgette             | 2    | vegetable         | Peeled, well-cooked. Skin can be included if very well cooked and soft.                   |
| 9         | peeled cucumber       | 2    | vegetable         | Peeled and de-seeded only. Exception to no-raw guidance — near-zero fibre.                |
| 10        | parsnip               | 2    | vegetable         | Peeled, well-cooked.                                                                      |
| 11        | cooked spinach        | 2    | vegetable         | Well-wilted, no raw spinach in Zones 1–2.                                                 |
| 12        | cooked tomato         | 2    | vegetable         | Peeled and de-seeded, or canned/passata. No raw tomato.                                   |
| 13        | cooked bell pepper    | 2    | vegetable         | Well-cooked or roasted, peeled, no seeds. Not raw (Zone 3).                               |
| 14        | swede                 | 2    | vegetable         | Peeled, well-cooked.                                                                      |
| 15        | cauliflower           | 2    | vegetable         | Florets only, no tough stalks, well-cooked. End of Zone 2 — gassy but tolerable.          |
| 27        | boiled potato         | 2    | root_vegetable    | Peeled, boiled/steamed potatoes. Bridge between mashed (1B) and baked (Zone 2).           |
| 28        | cooked beetroot       | 2    | root_vegetable    | Peeled, well-cooked. May cause red/purple stool discoloration — harmless.                 |
| 29        | plant milk            | 2    | dairy_alternative | Dairy alternatives for lactose-avoiding patients. Oat and rice milk gentlest.             |
| 16        | roasted potato        | 3    | vegetable         | Peeled, roasted with oil. Zone 3 due to fat.                                              |
| 17        | broccoli              | 3    | vegetable         | Cruciferous, gassy, high output risk. Florets only, no stalks.                            |
| 18        | green beans           | 3    | vegetable         | Stringy, gassy.                                                                           |
| 19        | leek                  | 3    | vegetable         | Essentially an onion — gas and high output risk.                                          |
| 20        | onion                 | 3    | vegetable         | Gas, odour, and high output risk even when cooked.                                        |
| 21        | sweetcorn             | 3    | vegetable         | Hulls pass through undigested — blockage risk. Popcorn also Zone 3.                       |
| 22        | raw salad             | 3    | vegetable         | Raw vegetables consistently Zone 3 in all post-surgical guidelines.                       |
| 23        | mushrooms             | 3    | vegetable         | Polysaccharides cause high output and gas. Zone 3 even when cooked.                       |
| 30        | coffee                | 3    | hot_drink         | Stimulates colonic motility. Even decaf has effect. Last thing most patients reintroduce. |

#### Fruit Line (`fruit`)

| lineOrder | Station         | Zone | Subcategory | Notes                                                                                    |
| --------- | --------------- | ---- | ----------- | ---------------------------------------------------------------------------------------- |
| 0         | diluted juice   | 1A   | juice       | Clear or strained juice only — no pulp. Dilute 50:50 initially.                          |
| 15        | ice lolly       | 1A   | frozen      | Smooth ice lollies only — no fruit pieces, no dairy. Essentially frozen juice.           |
| 1         | ripe banana     | 1B   | fruit       | Must be fully ripe — green/underripe bananas can increase output.                        |
| 2         | stewed apple    | 1B   | fruit       | Peeled, stewed or cooked until soft. No raw apple.                                       |
| 3         | canned pear     | 1B   | fruit       | Canned/tinned in juice, or freshly stewed, peeled. Very low residue.                     |
| 4         | canned peach    | 1B   | fruit       | Canned/tinned in juice. Soft, very low residue.                                          |
| 5         | melon           | 2    | fruit       | Ripe, no skin. Low fibre, very high water content.                                       |
| 6         | ripe mango      | 2    | fruit       | Ripe, no skin. Good source of soluble fibre.                                             |
| 7         | peeled apple    | 2    | fruit       | Peeled raw apple. Easier than raw apple with skin (Zone 3), harder than stewed (Zone 1). |
| 17        | grapes          | 2    | fruit       | Peeled or seedless preferred. Moderate fructose.                                         |
| 18        | canned mandarin | 2    | fruit       | Canned mandarin in juice/syrup — acid neutralized by canning.                            |
| 8         | mandarin        | 3    | fruit       | Fresh mandarin/tangerine/clementine. Zone 3 due to citrus acid.                          |
| 9         | kiwi            | 3    | fruit       | Actinidin enzyme stimulates bowel motility. Seeds throughout flesh.                      |
| 10        | citrus fruit    | 3    | fruit       | Orange, grapefruit. Pith/membrane tough fibre. Concentrated vitamin C.                   |
| 11        | pineapple       | 3    | fruit       | Bromelain enzyme and fibrous flesh. Can be very stimulating.                             |
| 12        | strawberries    | 3    | fruit       | Seeds on skin/inside. Includes all berries (blueberries, raspberries, blackberries).     |
| 13        | dried fruit     | 3    | fruit       | Very concentrated fibre and fructose. Prunes especially known as bowel stimulants.       |
| 14        | exotic fruit    | 3    | fruit       | Variable fibre, seeds, enzymes (papaya, dragon fruit, passion fruit, lychee).            |
| 16        | apple           | 3    | fruit       | Raw apple with skin — high insoluble fibre, firm texture.                                |
| 19        | fig             | 3    | fruit       | Very high fibre and small seeds. Natural laxative.                                       |
| 20        | pomegranate     | 3    | fruit       | Hundreds of small seeds — blockage concern.                                              |

---

### Fats Corridor

#### Oils Line (`oils`)

| lineOrder | Station         | Zone | Subcategory | Notes                                                                              |
| --------- | --------------- | ---- | ----------- | ---------------------------------------------------------------------------------- |
| 1         | olive oil       | 1B   | oil         | Small amounts in cooking. Monounsaturated fat.                                     |
| 2         | vegetable oil   | 2    | oil         | For cooking. Small amounts only. Coconut oil has own Zone 3 entry.                 |
| 3         | deep fried food | 3    | processed   | High fat from deep frying consistently causes diarrhea. Chips/fries always Zone 3. |

#### Dairy Fats Line (`dairy_fats`)

| lineOrder | Station          | Zone | Subcategory  | Notes                                                                           |
| --------- | ---------------- | ---- | ------------ | ------------------------------------------------------------------------------- |
| 1         | butter           | 2    | butter_cream | Small amounts as spread or in cooking. Zone changed from 1B to 2.               |
| 2         | cream cheese     | 2    | cheese       | Soft, smooth dairy. Includes ricotta and quark.                                 |
| 3         | hard cheese      | 2    | cheese       | Small amounts. Hard cheeses — use as topping, not main dish.                    |
| 4         | mozzarella       | 2    | dairy        | Soft fresh cheeses. Lower lactose than aged cheese.                             |
| 5         | cream            | 2    | butter_cream | Small amounts in cooking only. Too much can worsen loose stools.                |
| 6         | plain ice cream  | 2    | dessert      | Plain vanilla. Small portion. High fat and sugar — limit to occasional serving. |
| 7         | soft rind cheese | 3    | cheese       | Very high fat (brie, camembert, blue cheese). Can worsen loose stools.          |
| 8         | double cream     | 3    | butter_cream | Very high saturated fat. More concentrated than Zone 2 single cream.            |

#### Nuts & Seeds Line (`nuts_seeds`)

| lineOrder | Station           | Zone | Subcategory | Notes                                                                       |
| --------- | ----------------- | ---- | ----------- | --------------------------------------------------------------------------- |
| 1         | avocado           | 2    | fruit       | Healthy monounsaturated fat. Small portions — high fat can increase output. |
| 2         | smooth nut butter | 2    | nut_seed    | Smooth only — no crunchy. Trial cautiously from stable Zone 2 baseline.     |
| 3         | nuts              | 3    | nut_seed    | Blockage risk from skins. Smooth nut butters have Zone 2 entry.             |
| 4         | seeds             | 3    | nut_seed    | Blockage risk — small seeds can accumulate.                                 |
| 5         | guacamole         | 3    | fruit       | Avocado plus onion/lime/cilantro/chili. Combined irritant load.             |
| 6         | coconut           | 3    | nut         | High fat and fibre. Desiccated coconut is very high fibre.                  |

---

### Seasoning Corridor

#### Sauces & Condiments Line (`sauces_condiments`)

| lineOrder | Station             | Zone | Subcategory | Notes                                                                               |
| --------- | ------------------- | ---- | ----------- | ----------------------------------------------------------------------------------- |
| 1         | salt                | 1B   | seasoning   | Sea salt, table salt, rock salt.                                                    |
| 2         | soy sauce           | 2    | sauce       | Small amounts. Tamari is gluten-free equivalent.                                    |
| 3         | smooth tomato sauce | 2    | sauce       | Smooth only — no chunks, seeds, or garlic/onion. Ketchup in small amounts.          |
| 4         | mild mustard        | 2    | sauce       | Small amounts as condiment. Wholegrain mustard has seeds — use sparingly.           |
| 5         | white sauce         | 2    | sauce       | Milk-based sauce thickened with flour. No garlic or onion base.                     |
| 6         | gravy               | 2    | sauce       | Smooth gravy only. No onion pieces or peppercorn-heavy gravy.                       |
| 7         | honey               | 2    | sugar       | Small amounts as smooth sweetener. Treat as condiment not free food.                |
| 8         | jam                 | 2    | sugar       | Smooth or seedless fruit spread only. Keep separate from chunky preserves.          |
| 12        | citrus juice        | 2    | acid        | Condiment-quantity citrus juice (lemon, lime) as flavouring. Not whole citrus.      |
| 9         | miso soup           | 3    | broth       | Fermented soy broth. Carries soy solids/seasoning, often with seaweed.              |
| 10        | hot sauce           | 3    | irritant    | Capsaicin-based sauces. Direct GI irritant even in small quantities.                |
| 11        | non-sugar sweetener | 3    | sugar       | Stevia, sucralose, aspartame, saccharin. Low residue, different profile from sugar. |

#### Herbs & Spices Line (`herbs_spices`)

| lineOrder | Station         | Zone | Subcategory | Notes                                                                                   |
| --------- | --------------- | ---- | ----------- | --------------------------------------------------------------------------------------- |
| 2         | mild herb       | 2    | herb        | Dried or fresh culinary herbs (thyme, rosemary, basil, sage). Moderate cooking amounts. |
| 3         | mild spice      | 2    | spice       | Mild, non-hot ground spices (cinnamon, nutmeg, turmeric, ground ginger).                |
| 4         | black pepper    | 3    | spice       | Piperine is a mild GI irritant. Zone changed from 2 to 3.                               |
| 5         | garlic          | 3    | herb        | Gas, odour, and high output risk in all bowel surgery guidelines.                       |
| 6         | chili           | 3    | irritant    | Capsaicin directly stimulates bowel motility. Most consistent GI irritant.              |
| 7         | hot spice blend | 3    | spice       | Complex spice blends containing chili, garlic powder, or onion powder.                  |

---

## Section 2: Data Model Summary

### For the designer — how the map data works

**The registry is the map's skeleton.** `shared/foodRegistryData.ts` defines every station — its name, zone, line, lineOrder, and clinical notes. This list is fixed between releases. When you define station positions in your SVG geometry, you are positioning these 147 canonical entries. They never move.

**Evidence colors are the map's skin.** The app logs what the user eats, waits 6 hours, then correlates each food with subsequent bowel outcomes. This produces "evidence" per station. The hook `useTransitMapData` fuses registry structure + evidence into a `TransitNetwork` object. Stations with no evidence are ghosted (grey); stations with evidence display their status color.

**Status values (what determines each station's visual state):**

| Status            | Color                | Meaning                                          |
| ----------------- | -------------------- | ------------------------------------------------ |
| `null` / untested | Grey, low opacity    | Never trialled — ghosted on the map              |
| `building`        | Blue (subtle pulse)  | Active trials, insufficient evidence to conclude |
| `safe`            | Green, fully visible | Consistently good digestive outcomes             |
| `watch`           | Amber                | Concerning outcomes — user should be cautious    |
| `avoid`           | Red                  | Consistent bad outcomes — logged but not blocked |

**Each station carries these data fields at runtime:**

| Field               | Type                                                 | Meaning                                                       |
| ------------------- | ---------------------------------------------------- | ------------------------------------------------------------- |
| `canonical`         | string                                               | Station identifier (e.g., `"white rice"`)                     |
| `displayName`       | string                                               | Formatted display name (e.g., `"White Rice"`)                 |
| `zone`              | 1 \| 2 \| 3                                          | Clinical recovery zone                                        |
| `subzone`           | "1A" \| "1B" \| undefined                            | Liquid vs soft solid for Zone 1                               |
| `lineOrder`         | number                                               | Suggested introduction order within the line                  |
| `primaryStatus`     | `safe` \| `building` \| `watch` \| `avoid` \| `null` | Evidence-derived status                                       |
| `tendency`          | `"on_time"` \| `"express"` \| `"delayed"` \| `null`  | Transit tendency                                              |
| `confidence`        | `"low"` \| `"moderate"` \| `"high"` \| `null`        | Bayesian confidence level                                     |
| `totalTrials`       | number                                               | How many times this food has been logged + resolved           |
| `bristolBreakdown`  | `{ [1-7]: count }`                                   | Bristol Stool Scale distribution across all trials            |
| `avgTransitMinutes` | number \| null                                       | Average food-to-BM transit time                               |
| `digestion`         | metadata object                                      | Clinical digestion metadata (fibre, fat risk, gas risk, etc.) |

**Tendency labels on the map:**

| Tendency  | Label     | Color hint         |
| --------- | --------- | ------------------ |
| `on_time` | "On time" | Neutral            |
| `express` | "Express" | Warn amber — loose |
| `delayed` | "Delayed" | Cool blue — hard   |

**The no-judgment principle.** A red station is NOT a failure — it is useful data. The map celebrates information gain, not compliance. Never use "blocked" or "prohibited" language anywhere near the design.

---

## Section 3: Visual Design Specification

### Mental Model

The map is an **explorer's map**, not a journey. The user explores freely within their current zone. There is no prescribed order within a line. The map shows exploration progress (visited vs. unvisited destinations), not route progress.

- Zones (1A, 1B, 2, 3) are the real structure — they represent clinical recovery stages
- Lines (Meat & Fish, Grains, etc.) are organisational categories, not sequential routes
- "Next food" means what's available in the user's zone, not the next stop on a track

### Layout: Radial Concentric

- **Zone 1A** (9 stations, very sparse) — at the center
- **Zone 1B** (29 stations) — first ring
- **Zone 2** (59 stations) — second ring, bulk of the map
- **Zone 3** (50 stations) — outer edges, minimal (3-4 representative stations per line branching off)

**Lines radiate outward from the center through zone rings.** Bigger lines (vegetables: 31, grains: 30, fruit: 21) get longer, more prominent paths. Tiny lines (oils: 3, vegetable_protein: 3) are short stubs.

**Corridors are NOT equal quadrants.** Each corridor occupies a different angular region with its own organic shape. Lines within a corridor spread out like tributaries, not parallel tracks.

### Geometry Style

London Underground style — organic, asymmetric, and hand-crafted. Lines should curve and bend like real transit infrastructure, not align to a grid. Key constraints:

- Lines radiate outward from center through zone rings
- Bigger lines get longer, more prominent paths
- Tiny lines are short stubs at the inner rings
- Zone 3 is minimal — only 3-4 branching stubs per line at the outer edge
- Station circles must not overlap — minimum spacing between adjacent stations
- Zone boundaries are visible as concentric ring arcs (not solid circles) behind the lines
- Interchange markers appear where lines cross zone boundaries

### Zoom Levels (4 discrete, animated step-zoom)

| Level              | What's visible                                | Labels                                                           |
| ------------------ | --------------------------------------------- | ---------------------------------------------------------------- |
| 1. Radial overview | All 4 corridors, zone rings, all station dots | 2-3 representative stations per line (lowest lineOrder per zone) |
| 2. Corridor        | One corridor's lines bright, others dimmed    | Representative stations for that corridor                        |
| 3. Line            | One line highlighted, all its stations        | All station names on that line                                   |
| 4. Station focus   | 3-4 neighboring stations                      | Station name + inline detail callout on the canvas               |

Transitions use animated CSS `transform: scale() translate()` — the SVG doesn't re-render, it scales and pans.

### Station Rendering

Each station = a circle on the SVG path.

- Green (safe): bright, fully visible
- Blue (building): bright, subtle pulse animation
- Amber (watch): bright
- Red (avoid): bright
- Grey, low opacity: unexplored/untested (ghosted)

The map "lights up" as the user explores — motivating but not gamified.

### Station Focus Callout

When a user taps a station at line-zoom level, the map zooms to show the station's neighborhood. A detail callout renders **on the canvas** (as a `<foreignObject>` or absolutely positioned HTML beside the station cluster). It is never a separate panel, never an overlay that covers the map.

The callout displays:

- Station name + zone badge
- Status, confidence, tendency metrics
- Trial count + Bristol breakdown (compact)
- Digestion badges
- AI verdict if available

### Mobile Behaviour

The SVG canvas has its own natural size (wider than portrait viewport).

- **Portrait:** user sees a slice and swipes left/right to pan
- **Landscape:** whole map visible
- Touch: `touch-action: pan-x pan-y` on the container
- Tap to step-zoom, swipe to pan

The station detail callout is part of the canvas — no separate panels on mobile either.

---

## Section 4: Tech Stack for the Designer

| Layer              | Technology            | Details                                                          |
| ------------------ | --------------------- | ---------------------------------------------------------------- |
| Map geometry       | SVG                   | `<path>`, `<circle>`, `<arc>` elements for lines and stations    |
| Labels             | HTML overlay          | Positioned absolutely via coordinate transforms from SVG `x, y`  |
| Framework          | React 19 + TypeScript | Strict mode, `exactOptionalPropertyTypes`                        |
| Styling            | Tailwind v4           | CSS custom properties (`--primary`, `--background`, etc.)        |
| Zoom/pan animation | CSS transforms        | `transform: scale() translate()` — SVG scales, doesn't re-render |
| External charting  | None                  | Zero external charting/SVG libraries                             |

### The geometry hook

The developer will create `useTransitMapGeometry.ts` which returns a `MapGeometry` object. This hook consumes `TransitNetwork` (from the data layer) and returns positioned SVG geometry. The designer's deliverables feed directly into this hook's constants:

```typescript
interface MapGeometry {
  viewBox: { width: number; height: number };
  zoneRings: Array<{ zone: string; radius: number; label: string }>;
  lines: Array<{
    line: FoodLine; // "grains", "vegetables", etc.
    group: FoodGroup; // "carbs", "protein", etc.
    path: string; // SVG path d attribute ← DESIGNER DELIVERS THIS
    color: string; // line color
    stations: Array<{
      canonical: string; // matches registry canonical
      x: number; // ← DESIGNER DELIVERS THIS
      y: number; // ← DESIGNER DELIVERS THIS
      isRepresentative: boolean;
    }>;
  }>;
  interchanges: Array<{ x: number; y: number; zone: string }>;
}
```

---

## Section 5: What the Designer Delivers

The designer's primary output is a set of static geometry constants that the developer drops into `useTransitMapGeometry.ts`. The map does not need to be interactive at the design stage — geometry is the key artifact.

### Deliverable 1: SVG path data for each food line

One SVG path `d` attribute per line. 11 paths total. The path starts near the center (Zone 1A radius) and terminates at the Zone 3 outer edge.

Example format:

```
meat_fish: "M 480 400 L 460 350 Q 430 300 410 260 L 380 190 L 340 120"
vegetables: "M 480 400 Q 500 380 520 340 L 550 280 Q 570 240 590 180 ..."
```

The path must pass through each zone ring at the right radius so stations can be positioned at zone-appropriate distances from center.

### Deliverable 2: Station coordinates

For every station on every line: `{ canonical, x, y }`.

Stations are positioned along their line's SVG path. Zone determines approximate radius (Zone 1A close to center, Zone 3 far out). `lineOrder` determines relative position along the path.

Example format:

```
{ canonical: "white rice", x: 522, y: 334 },
{ canonical: "toast", x: 538, y: 315 },
...
```

Stations must not overlap. Minimum gap between adjacent station circles = 2 × station radius + 4px clearance.

### Deliverable 3: Zone ring geometry

Four concentric ring radii marking zone boundaries. These become light arcs (not solid circles) drawn behind the lines.

```
zone_1a_radius: 60px   (center region, very sparse)
zone_1b_radius: 160px  (first solid ring)
zone_2_radius: 360px   (second ring, bulk of map)
zone_3_radius: 540px   (outer edge, optional/minimal)
```

The actual radii are the designer's creative decision — these are illustrative values.

### Deliverable 4: Interchange positions

Where lines cross zone boundary rings, a small interchange marker is drawn. These are cosmetic but add visual authenticity.

Format: `{ line: "grains", zone: "1B", x: 500, y: 340 }`

### Deliverable 5: ViewBox dimensions

The overall SVG canvas size. This determines the coordinate space for all other deliverables.

Suggested minimum: `1200 × 1200` (portrait-biased maps tend wider, landscape-biased maps wider still). The designer should choose based on station density and desired visual breathing room.

### Deliverable 6: Corridor color palette

Each corridor has a base hue. Each line within a corridor gets a shade or variant.

| Corridor  | Suggested hue family    |
| --------- | ----------------------- |
| Protein   | Warm reds / terracottas |
| Carbs     | Blues / teals           |
| Fats      | Yellows / ambers        |
| Seasoning | Greens / sage           |

Each line needs:

- A primary track color (for the SVG `<path>` stroke)
- A lighter variant (for zone-boundary markers and dimmed state)

Also define:

- Zone ring arc colors (subtle, low-contrast against the background)
- Ghosted station color (grey, ~30% opacity)
- Station outline / active state colors

### Deliverable 7: Representative stations

For each line, identify 2-3 stations to label at overview and corridor zoom (when all labels would be too dense). Select the lowest `lineOrder` entries per zone — these are the foods the user will encounter earliest.

Suggested representative stations per line:

| Line              | Representative stations                      |
| ----------------- | -------------------------------------------- |
| meat_fish         | clear broth, boiled fish, grilled white meat |
| eggs_dairy        | egg, plain yogurt, milk                      |
| vegetable_protein | tofu                                         |
| grains            | white rice, toast, white bread               |
| vegetables        | mashed potato, boiled carrot, courgette      |
| fruit             | ripe banana, stewed apple, melon             |
| oils              | olive oil                                    |
| dairy_fats        | butter, cream cheese                         |
| nuts_seeds        | avocado                                      |
| sauces_condiments | salt, smooth tomato sauce                    |
| herbs_spices      | mild herb                                    |

---

## Section 6: Zone Ring Guidance

Zones represent clinical recovery stages. The visual weight between zones should reflect how much is in each:

| Zone | Station count | Relative map area                                             |
| ---- | ------------- | ------------------------------------------------------------- |
| 1A   | 9             | Center — very tight, sparse, almost symbolic                  |
| 1B   | 29            | First ring — noticeable but not crowded                       |
| 2    | 59            | Second ring — the majority of the map, most visual weight     |
| 3    | 50            | Outer edge — minimal representation per line (3-4 stubs only) |

Zone 3 is deliberately underrepresented visually. The user's focus is on Zones 1-2. Zone 3 stubs at the edges communicate "this territory exists but you're not there yet."

Zone boundaries should be legible arc segments with zone labels ("Zone 1A", "Zone 1B", "Zone 2", "Zone 3"). Labels should be subtle — secondary information, not dominant text.

---

## Appendix: Zone 1 Notes

Zone 1 entries use a two-level system:

- **Zone 1A** — clear and full liquids (9 entries). On the map, these sit at the very center.
- **Zone 1B** — soft, low-residue solids (29 entries). These populate the first ring.

The `subzone` field (`"1A"` or `"1B"`) is present on all zone 1 entries and absent on zone 2 and 3 entries. Station colors and ring positions should differentiate 1A from 1B even though both are "Zone 1".

---

## Appendix: Line Display Names

| Line key            | Display name        |
| ------------------- | ------------------- |
| `meat_fish`         | Meat & Fish         |
| `eggs_dairy`        | Eggs & Dairy        |
| `vegetable_protein` | Vegetable Protein   |
| `grains`            | Grains              |
| `vegetables`        | Vegetables          |
| `fruit`             | Fruit               |
| `oils`              | Oils                |
| `dairy_fats`        | Dairy & Fats        |
| `nuts_seeds`        | Nuts & Seeds        |
| `sauces_condiments` | Sauces & Condiments |
| `herbs_spices`      | Herbs & Spices      |

---

_Generated 2026-03-20 from `shared/foodRegistryData.ts`. Station count: 147 total (9 Zone 1A + 29 Zone 1B + 59 Zone 2 + 50 Zone 3)._

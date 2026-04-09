## Decisions made 2026-04-03

### 1. Three log types: food, liquid, fluid

- `type: "food"` — solid food
- `type: "liquid"` — non-water beverages (coffee, juice, tea, etc.)
- `type: "fluid"` — water only
- Historical non-water fluid logs must be backfilled to `type: "liquid"`
- This is a NEW schema change not in the original plan

### 2. Coffee QuickCapture → food/liquid log

- QuickCapture coffee tap should create a `type: "liquid"` log entry
- Coffee = composite: 200ml water + 50ml skimmed milk + coffee
- Default portion: 250ml total
- The composite breakdown needs to be defined in the food registry
- Other QuickCapture fluid habits should follow the same pattern

### 3. Meal slot times confirmed

- Breakfast: 5am-9am
- Lunch: 1pm-4pm
- Dinner: 8pm-11pm
- Else: Snack

### 4. Calorie goal: 1,850 kcal/day

- Based on: male, 52y, 186cm, 105kg, sedentary, target 95kg
- Mifflin-St Jeor BMR: 1,958 kcal, TDEE: 2,349, deficit 500 = 1,849
- Rounded to 1,850 kcal as default
- Water goal: 1,000ml (unchanged)

### 5. FOOD_PORTION_DATA must be pre-populated

- NOT empty at launch — all 147 entries need portion + nutrition data
- Sources: USDA FoodData Central, Open Food Facts API, ingredientProfiles
- Standard portion sizes must be researched (tsp=5g, tbsp=15g, slice bread=~30g, etc.)
- Natural units must have gram equivalents
- This is a data population task that blocks Wave 2 UI work

**How to apply:** The plan needs updating: (1) add `type: "liquid"` to schema, (2) add data migration task for fluid→liquid backfill, (3) add QuickCapture coffee→liquid wiring, (4) add data population task for FOOD_PORTION_DATA before UI work starts.

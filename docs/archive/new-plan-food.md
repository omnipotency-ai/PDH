# Vision

- By moving the Registry into Convex and hooking into a UK-based API, we are graduating from a **hardcoded tracker** to a **dynamic, future-proof Diet Platform.**
- This approach keeps our options wide open: by structuring it this way now, adding features like a **Barcode Scanner** later will be incredibly easy
  
## Implementation plan

- Future Proof: It builds the working prototype safely without painting us into a corner

---

## The New Architecture

### 1. The Global Layer: `clinicalRegistry` (Convex)

- What it is: Replaces the static `foodRegistryData.ts` file.
- Contains: The medical baseline (`canonicalName`, `zone`, `bristol_impact`, `transit_time`).
- Access: Global. Everyone uses the same medical rules. You get an Admin UI to edit these.

### 2. The Personal Layer: `ingredientProfiles` / Product Catalog (Convex)

- What it is: Your personal kitchen inventory.
- Contains: `productName` (Bon Preu Bread), `nutritionPer100g`, `customPortions` (1 Slice = 31.5g).
- Link: Every product must have a `registryId` pointing to the `clinicalRegistry`.

### 3. The API Layer: OpenFoodFacts UK (Convex Actions)

- What it is: A serverless function that queries the OpenFoodFacts database (which has massive UK supermarket coverage: Tesco, Sainsbury's, generic UK brands).

---

## The Step-by-Step Execution Plan

### Phase 1: Database Foundation & Migration

We prepare the databases and move the static data into Convex.

1. **Create the `clinicalRegistry` Schema:** Define the table in `convex/schema.ts` to hold the Zone and Medical data.
2. **Update `ingredientProfiles` Schema:** Add `productName`, `customPortions` array, `barcode` (for future-proofing), and `registryId` to link them to the medical rules.
3. **The Great Migration Script:** Write a one-time Convex mutation (`convex/migrations.ts`) that reads your current `shared/foodRegistryData.ts` file and inserts all 4,000+ items into the new `clinicalRegistry` table.

### Phase 2: Auto-Query API & "Add Product" Flow

We build the mechanism to fetch UK data and create your specific products.

1. **The Convex Action (`convex/foodApi.ts`):** Write an action that takes a search term (e.g., "Hovis Seeded Bread") and pings the OpenFoodFacts API (filtered for UK). It returns the standard macros.
2. **The "Add Product" UI:**
    - When you search for food and don't see your brand, you tap "Add New."
    - You search the UK API. It auto-fills the Kcal, Protein, Fats, Carbs, etc.
    - *The Magic Step:* A dropdown asks you: *"What Medical Category is this?"* You select "White Bread" or "Seeded Bread" (linking it to the clinical registry).
    - You add your custom portions (e.g., "1 Slice = 35g").
    - Hit Save. It's in your personal database forever.

### Phase 3: Rewiring the Math & Logging (The Bug Fix)

We fix the logging pipeline to use your new Product Custom Portions instead of the old, broken static file.

1. **Refactor `useNutritionStore.ts`:** When you select a food to stage, it pulls the `customPortions` array from the Product.
2. **Fix the Math (`nutritionUtils.ts`):** If you select "2 Slices" of Bon Preu, the app looks up "Slice" in that specific product's profile, sees 31.5g, calculates 63g total, and applies the exact macros. *No more generic 25kcal errors.*

### Phase 4: Admin UIs & Polish

We build the interfaces to manage this new ecosystem.

1. **Registry Admin Page:** A simple, data-table UI (accessible only to you/admins) that lists the 4,000 clinical categories, allowing you to edit Zones, Osmotic properties, etc., directly in the browser.
2. **Product Manager Page:** Your personal Food Page where you can see all your brands, tweak their portion weights, and adjust macros if the UK API was slightly off.
3. **Seed Your ~30 Foods:** We run a quick script to populate your 30 core daily foods into your Product catalog so you can start testing the app immediately without starting from zero.

---

## Why this is the perfect balance (Simplified Complexity)

- **No math density nightmares:** You just weigh a slice/scoop once and save it to the product.
- **Future-Proof:** By building an API fetcher Action now, adding a "Scan Barcode" button on the phone later requires almost zero database changes. We just pass the barcode to the exact same Convex Action.
- **Safe Prototype:** It creates a highly usable app **right now**.

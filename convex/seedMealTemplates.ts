import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export type StructuredIngredientSeed = {
  canonicalName: string;
  quantity: number;
  unit: string;
};

export type MealModifierSeed = StructuredIngredientSeed & {
  isDefault: boolean;
};

export type SlotDefaultSeed = {
  slot: "breakfast" | "lunch" | "dinner" | "snack";
  overrides: StructuredIngredientSeed[];
};

export type MealTemplateSeedDefinition = {
  canonicalName: string;
  type: "composite";
  ingredients: string[];
  structuredIngredients: StructuredIngredientSeed[];
  modifiers: MealModifierSeed[];
  sizes: Array<{
    name: string;
    adjustments: StructuredIngredientSeed[];
  }>;
  slotDefaults: SlotDefaultSeed[];
};

export const MEAL_TEMPLATE_DEFINITIONS: ReadonlyArray<MealTemplateSeedDefinition> = [
  {
    canonicalName: "coffee + toast",
    type: "composite",
    ingredients: ["coffee", "toast"],
    structuredIngredients: [
      { canonicalName: "coffee", quantity: 200, unit: "ml" },
      { canonicalName: "toast", quantity: 2, unit: "slice" },
    ],
    modifiers: [
      { canonicalName: "milk", quantity: 30, unit: "ml", isDefault: false },
      { canonicalName: "sugar", quantity: 1, unit: "tsp", isDefault: false },
      { canonicalName: "butter", quantity: 1, unit: "tsp", isDefault: false },
      { canonicalName: "jam", quantity: 1, unit: "tsp", isDefault: false },
    ],
    sizes: [],
    slotDefaults: [
      {
        slot: "breakfast",
        overrides: [
          { canonicalName: "coffee", quantity: 200, unit: "ml" },
          { canonicalName: "toast", quantity: 2, unit: "slice" },
        ],
      },
    ],
  },
  {
    canonicalName: "toast + spread",
    type: "composite",
    ingredients: ["toast"],
    structuredIngredients: [{ canonicalName: "toast", quantity: 2, unit: "slice" }],
    modifiers: [
      { canonicalName: "butter", quantity: 1, unit: "tsp", isDefault: false },
      { canonicalName: "jam", quantity: 1, unit: "tsp", isDefault: false },
      {
        canonicalName: "peanut butter",
        quantity: 1,
        unit: "tsp",
        isDefault: false,
      },
      {
        canonicalName: "cream cheese",
        quantity: 1,
        unit: "tbsp",
        isDefault: false,
      },
    ],
    sizes: [],
    slotDefaults: [
      {
        slot: "breakfast",
        overrides: [{ canonicalName: "toast", quantity: 2, unit: "slice" }],
      },
    ],
  },
];

export function buildMealTemplateRows(userId: string, now: number) {
  return MEAL_TEMPLATE_DEFINITIONS.map((definition) => ({
    userId,
    canonicalName: definition.canonicalName,
    type: definition.type,
    ingredients: definition.ingredients,
    structuredIngredients: definition.structuredIngredients,
    modifiers: definition.modifiers,
    sizes: definition.sizes,
    slotDefaults: definition.slotDefaults,
    createdAt: now,
  }));
}

export const seedMealTemplates = internalMutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let inserted = 0;
    let skipped = 0;

    for (const row of buildMealTemplateRows(args.userId, now)) {
      const existingRows = await ctx.db
        .query("foodLibrary")
        .withIndex("by_userId_name", (q) =>
          q.eq("userId", args.userId).eq("canonicalName", row.canonicalName),
        )
        .collect();

      if (existingRows.length === 0) {
        await ctx.db.insert("foodLibrary", row);
        inserted += 1;
        continue;
      }

      const [_keeper, ...duplicates] = existingRows
        .slice()
        .sort((a, b) => a.createdAt - b.createdAt || a._creationTime - b._creationTime);

      for (const duplicate of duplicates) {
        await ctx.db.delete(duplicate._id);
      }

      skipped += 1;
    }

    return {
      inserted,
      skipped,
      total: inserted + skipped,
    };
  },
});

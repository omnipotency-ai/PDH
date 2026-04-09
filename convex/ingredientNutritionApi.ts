"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { requireAuth } from "./lib/auth";
import { asNumber, asStringArray, asTrimmedString } from "./lib/coerce";

// Reasonable upper bounds per 100g to catch malformed OFF data.
const NUTRIENT_MAX: Record<string, number> = {
  kcal: 9000, // pure fat ~900 kcal/100g; 9000 gives headroom for errors
  fatG: 100,
  saturatedFatG: 100,
  carbsG: 100,
  sugarsG: 100,
  fiberG: 100,
  proteinG: 100,
  saltG: 100,
};

function readNutrient(
  nutriments: Record<string, unknown>,
  keys: string[],
  maxKey?: keyof typeof NUTRIENT_MAX,
): number | null {
  for (const key of keys) {
    const value = asNumber(nutriments[key], { coerceString: true });
    if (value === undefined) continue;
    if (!Number.isFinite(value) || value < 0) return null;
    if (maxKey !== undefined && value > NUTRIENT_MAX[maxKey]) return null;
    return value;
  }
  return null;
}

export const lookupBarcode = action({
  args: {
    barcode: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const barcode = args.barcode.trim().replace(/\D/g, "");
    if (barcode.length < 8 || barcode.length > 14) {
      return null;
    }

    const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=code,product_name,brands,ingredients_text,categories_tags,nutriments`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    let response: Response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": "PDH/1.0 (barcode lookup)",
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      status?: number;
      product?: Record<string, unknown>;
    };

    if (payload.status !== 1 || !payload.product) {
      return null;
    }

    const row = payload.product;
    const displayName = asTrimmedString(row.product_name, {
      normalizeWhitespace: true,
    });
    if (displayName === undefined) return null;

    const nutriments =
      row.nutriments !== null && typeof row.nutriments === "object"
        ? (row.nutriments as Record<string, unknown>)
        : {};

    return {
      externalId: barcode,
      displayName,
      brand: asTrimmedString(row.brands, { normalizeWhitespace: true }) ?? null,
      ingredientsText:
        asTrimmedString(row.ingredients_text, {
          normalizeWhitespace: true,
        }) ?? null,
      categories: asStringArray(row.categories_tags, {
        normalizeWhitespace: true,
        dedupe: true,
        maxItems: 20,
      }),
      nutritionPer100g: {
        kcal: readNutrient(
          nutriments,
          ["energy-kcal_100g", "energy-kcal"],
          "kcal",
        ),
        fatG: readNutrient(nutriments, ["fat_100g", "fat"], "fatG"),
        saturatedFatG: readNutrient(
          nutriments,
          ["saturated-fat_100g", "saturated-fat"],
          "saturatedFatG",
        ),
        carbsG: readNutrient(
          nutriments,
          ["carbohydrates_100g", "carbohydrates"],
          "carbsG",
        ),
        sugarsG: readNutrient(nutriments, ["sugars_100g", "sugars"], "sugarsG"),
        fiberG: readNutrient(nutriments, ["fiber_100g", "fiber"], "fiberG"),
        proteinG: readNutrient(
          nutriments,
          ["proteins_100g", "proteins"],
          "proteinG",
        ),
        saltG: readNutrient(nutriments, ["salt_100g", "salt"], "saltG"),
      },
    };
  },
});

export const searchOpenFoodFacts = action({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const query = args.query.trim().slice(0, 200);
    if (query.length < 2) {
      return [];
    }

    const limit = Math.min(Math.max(Math.round(args.limit ?? 6), 1), 15);
    const url = new URL("https://world.openfoodfacts.org/cgi/search.pl");
    url.searchParams.set("search_terms", query);
    url.searchParams.set("search_simple", "1");
    url.searchParams.set("action", "process");
    url.searchParams.set("json", "1");
    url.searchParams.set("page_size", String(limit));
    url.searchParams.set(
      "fields",
      [
        "code",
        "product_name",
        "brands",
        "ingredients_text",
        "categories_tags",
        "nutriments",
      ].join(","),
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "User-Agent": "PDH/1.0 (ingredient nutrition lookup)",
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new Error(`OpenFoodFacts lookup failed (${response.status}).`);
    }

    const payload = (await response.json()) as {
      products?: Array<Record<string, unknown>>;
    };

    const rows = Array.isArray(payload.products) ? payload.products : [];
    const mapped = rows
      .map((row) => {
        const displayName = asTrimmedString(row.product_name, {
          normalizeWhitespace: true,
        });
        if (displayName === undefined) return null;

        const nutriments =
          row.nutriments !== null && typeof row.nutriments === "object"
            ? (row.nutriments as Record<string, unknown>)
            : {};

        return {
          externalId:
            asTrimmedString(row.code, { normalizeWhitespace: true }) ??
            displayName.toLowerCase(),
          displayName,
          brand:
            asTrimmedString(row.brands, { normalizeWhitespace: true }) ?? null,
          ingredientsText:
            asTrimmedString(row.ingredients_text, {
              normalizeWhitespace: true,
            }) ?? null,
          categories: asStringArray(row.categories_tags, {
            normalizeWhitespace: true,
            dedupe: true,
            maxItems: 20,
          }),
          nutritionPer100g: {
            kcal: readNutrient(
              nutriments,
              ["energy-kcal_100g", "energy-kcal"],
              "kcal",
            ),
            fatG: readNutrient(nutriments, ["fat_100g", "fat"], "fatG"),
            saturatedFatG: readNutrient(
              nutriments,
              ["saturated-fat_100g", "saturated-fat"],
              "saturatedFatG",
            ),
            carbsG: readNutrient(
              nutriments,
              ["carbohydrates_100g", "carbohydrates"],
              "carbsG",
            ),
            sugarsG: readNutrient(
              nutriments,
              ["sugars_100g", "sugars"],
              "sugarsG",
            ),
            fiberG: readNutrient(nutriments, ["fiber_100g", "fiber"], "fiberG"),
            proteinG: readNutrient(
              nutriments,
              ["proteins_100g", "proteins"],
              "proteinG",
            ),
            saltG: readNutrient(nutriments, ["salt_100g", "salt"], "saltG"),
          },
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .slice(0, limit);

    return mapped;
  },
});

"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { requireAuth } from "./lib/auth";

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length > 0 ? normalized : null;
}

function asNumber(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  return numeric;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const row of value) {
    const normalized = asString(row);
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
    if (out.length >= 20) break;
  }
  return out;
}

function readNutrient(
  nutriments: Record<string, unknown>,
  keys: string[],
): number | null {
  for (const key of keys) {
    const value = asNumber(nutriments[key]);
    if (value !== null) return value;
  }
  return null;
}

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
        const displayName = asString(row.product_name);
        if (!displayName) return null;

        const nutriments =
          row.nutriments !== null && typeof row.nutriments === "object"
            ? (row.nutriments as Record<string, unknown>)
            : {};

        return {
          externalId: asString(row.code) ?? displayName.toLowerCase(),
          displayName,
          brand: asString(row.brands),
          ingredientsText: asString(row.ingredients_text),
          categories: asStringArray(row.categories_tags),
          nutritionPer100g: {
            kcal: readNutrient(nutriments, ["energy-kcal_100g", "energy-kcal"]),
            fatG: readNutrient(nutriments, ["fat_100g", "fat"]),
            saturatedFatG: readNutrient(nutriments, [
              "saturated-fat_100g",
              "saturated-fat",
            ]),
            carbsG: readNutrient(nutriments, [
              "carbohydrates_100g",
              "carbohydrates",
            ]),
            sugarsG: readNutrient(nutriments, ["sugars_100g", "sugars"]),
            fiberG: readNutrient(nutriments, ["fiber_100g", "fiber"]),
            proteinG: readNutrient(nutriments, ["proteins_100g", "proteins"]),
            saltG: readNutrient(nutriments, ["salt_100g", "salt"]),
          },
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .slice(0, limit);

    return mapped;
  },
});

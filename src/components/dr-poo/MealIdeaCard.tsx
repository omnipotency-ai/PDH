import Markdown from "react-markdown";
import { AI_MARKDOWN_COMPONENTS } from "@/lib/aiMarkdownComponents";
import type { AiNutritionistInsight } from "@/types/domain";

type MealPlanEntry = AiNutritionistInsight["mealPlan"][number];

/**
 * Meal-slot color scheme: maps common slot keywords to gradient + accent colors.
 * Falls back to a neutral slate for unrecognized slot names.
 */
function getMealSlotStyle(meal: string): {
  gradient: string;
  accent: string;
  label: string;
} {
  const lower = meal.toLowerCase();

  if (lower.includes("breakfast") || lower.includes("morning")) {
    return {
      gradient: "from-amber-500/20 via-orange-500/10 to-transparent",
      accent: "text-amber-400",
      label: "text-amber-300/80",
    };
  }

  if (lower.includes("lunch") || lower.includes("midday")) {
    return {
      gradient: "from-emerald-500/20 via-green-500/10 to-transparent",
      accent: "text-emerald-400",
      label: "text-emerald-300/80",
    };
  }

  if (lower.includes("dinner") || lower.includes("evening")) {
    return {
      gradient: "from-indigo-500/20 via-violet-500/10 to-transparent",
      accent: "text-indigo-400",
      label: "text-indigo-300/80",
    };
  }

  if (lower.includes("snack")) {
    return {
      gradient: "from-rose-500/20 via-pink-500/10 to-transparent",
      accent: "text-rose-400",
      label: "text-rose-300/80",
    };
  }

  // Fallback for unrecognized meal slots
  return {
    gradient: "from-slate-500/20 via-slate-400/10 to-transparent",
    accent: "text-slate-400",
    label: "text-slate-300/80",
  };
}

/**
 * Extract simple food-type tags from item names for the badge footer.
 * Matches common dietary categories against the item text.
 */
function extractFoodTags(items: string[]): string[] {
  const tags = new Set<string>();
  // Guard against runaway AI output — only scan the first 20 items.
  const joined = items.slice(0, 20).join(" ").toLowerCase();

  const tagRules: Array<{ keywords: string[]; tag: string }> = [
    {
      keywords: [
        "chicken",
        "fish",
        "salmon",
        "tuna",
        "egg",
        "turkey",
        "beef",
        "tofu",
        "protein",
      ],
      tag: "protein",
    },
    {
      keywords: [
        "rice",
        "bread",
        "pasta",
        "oat",
        "potato",
        "noodle",
        "toast",
        "cereal",
        "grain",
      ],
      tag: "carbs",
    },
    {
      keywords: [
        "salad",
        "spinach",
        "broccoli",
        "carrot",
        "vegetable",
        "lettuce",
        "kale",
        "zucchini",
      ],
      tag: "vegetables",
    },
    {
      keywords: [
        "banana",
        "apple",
        "berry",
        "fruit",
        "mango",
        "melon",
        "peach",
        "pear",
      ],
      tag: "fruit",
    },
    { keywords: ["yogurt", "cheese", "milk", "dairy", "cream"], tag: "dairy" },
    {
      keywords: [
        "fibre",
        "fiber",
        "whole grain",
        "oat",
        "bran",
        "lentil",
        "bean",
      ],
      tag: "fibre",
    },
    {
      keywords: ["low-residue", "low residue", "plain", "bland", "gentle"],
      tag: "low-residue",
    },
    { keywords: ["soup", "broth", "stock"], tag: "soup" },
    {
      keywords: ["avocado", "olive oil", "butter", "nut", "almond", "fat"],
      tag: "healthy fats",
    },
  ];

  for (const rule of tagRules) {
    if (rule.keywords.some((kw) => joined.includes(kw))) {
      tags.add(rule.tag);
    }
  }

  return Array.from(tags).slice(0, 4);
}

interface MealIdeaCardProps {
  meal: MealPlanEntry;
}

/**
 * Blog-style card for a single meal idea.
 *
 * Layout:
 * - Header: gradient background with meal slot label (like an image banner)
 * - Body: menu items as readable text
 * - Footer: food-type badges as small rounded pills
 */
export function MealIdeaCard({ meal }: MealIdeaCardProps) {
  const style = getMealSlotStyle(meal.meal);
  const tags = extractFoodTags(meal.items);

  return (
    <div
      data-slot="meal-idea-card"
      className="glass-card overflow-hidden rounded-2xl"
    >
      {/* Header — gradient banner with meal slot name */}
      <div className={`bg-gradient-to-r ${style.gradient} px-4 py-3`}>
        <p
          className={`text-[10px] font-semibold uppercase tracking-widest ${style.label}`}
        >
          Meal Idea
        </p>
        <p className={`font-display text-base font-bold ${style.accent}`}>
          {meal.meal}
        </p>
      </div>

      {/* Body — menu items */}
      <div className="px-4 py-3">
        <ul className="space-y-1.5">
          {meal.items.map((item) => (
            <li
              key={item}
              className="flex items-start gap-2 text-sm text-[var(--text)]"
            >
              <span
                className={`mt-1.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-40 ${style.accent}`}
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        {/* Reasoning — subtle italic explanation */}
        <div className="prose-sm mt-3 border-t border-[var(--border)] pt-2.5 text-xs text-[var(--text-muted)] [&_em]:text-[var(--text-faint)] [&_strong]:text-[var(--text)]">
          <Markdown components={AI_MARKDOWN_COMPONENTS}>
            {meal.reasoning}
          </Markdown>
        </div>
      </div>

      {/* Footer — food-type badges */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-[var(--border)] px-4 py-2.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-[var(--surface-3)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)]"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

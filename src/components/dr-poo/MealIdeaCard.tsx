import Markdown from "react-markdown";
import { AI_MARKDOWN_COMPONENTS } from "@/lib/aiMarkdownComponents";
import type { AiNutritionistInsight } from "@/types/domain";

type MealPlanEntry = AiNutritionistInsight["mealPlan"][number];

/**
 * Meal-slot color scheme: maps common slot keywords to gradient + accent colors.
 * Uses design-system CSS variable tokens so colors adapt to dark/light themes.
 * Falls back to muted surface colors for unrecognized slot names.
 *
 * Tokens used (defined in src/index.css for both dark and light themes):
 *   --section-quick / --section-quick-muted    → amber   (breakfast)
 *   --section-observe / --section-observe-muted → emerald (lunch)
 *   --section-log / --section-log-muted         → indigo  (dinner)
 *   --section-summary / --section-summary-muted → rose    (snack)
 *   --text-muted / --text-faint / --surface-3   → neutral fallback
 *
 * gradient: CSS linear-gradient string — use in style={{ background }}
 * accent:   CSS color value string — use in style={{ color }}
 * label:    CSS color value string for sub-label — use in style={{ color }}
 */
function getMealSlotStyle(meal: string): {
  gradient: string;
  accent: string;
  label: string;
} {
  const lower = meal.toLowerCase();

  if (lower.includes("breakfast") || lower.includes("morning")) {
    return {
      gradient:
        "linear-gradient(to right, var(--section-quick-muted), color-mix(in srgb, var(--section-quick-muted) 50%, transparent), transparent)",
      accent: "var(--section-quick)",
      label: "var(--section-quick)",
    };
  }

  if (lower.includes("lunch") || lower.includes("midday")) {
    return {
      gradient:
        "linear-gradient(to right, var(--section-observe-muted), color-mix(in srgb, var(--section-observe-muted) 50%, transparent), transparent)",
      accent: "var(--section-observe)",
      label: "var(--section-observe)",
    };
  }

  if (lower.includes("dinner") || lower.includes("evening")) {
    return {
      gradient:
        "linear-gradient(to right, var(--section-log-muted), color-mix(in srgb, var(--section-log-muted) 50%, transparent), transparent)",
      accent: "var(--section-log)",
      label: "var(--section-log)",
    };
  }

  if (lower.includes("snack")) {
    return {
      gradient:
        "linear-gradient(to right, var(--section-summary-muted), color-mix(in srgb, var(--section-summary-muted) 50%, transparent), transparent)",
      accent: "var(--section-summary)",
      label: "var(--section-summary)",
    };
  }

  // Fallback for unrecognized meal slots
  return {
    gradient:
      "linear-gradient(to right, color-mix(in srgb, var(--surface-3) 60%, transparent), transparent)",
    accent: "var(--text-muted)",
    label: "var(--text-faint)",
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
      keywords: ["chicken", "fish", "salmon", "tuna", "egg", "turkey", "beef", "tofu", "protein"],
      tag: "protein",
    },
    {
      keywords: ["rice", "bread", "pasta", "oat", "potato", "noodle", "toast", "cereal", "grain"],
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
      keywords: ["banana", "apple", "berry", "fruit", "mango", "melon", "peach", "pear"],
      tag: "fruit",
    },
    { keywords: ["yogurt", "cheese", "milk", "dairy", "cream"], tag: "dairy" },
    {
      keywords: ["fibre", "fiber", "whole grain", "oat", "bran", "lentil", "bean"],
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
  const slotStyle = getMealSlotStyle(meal.meal);
  const tags = extractFoodTags(meal.items);

  return (
    <div data-slot="meal-idea-card" className="glass-card overflow-hidden rounded-2xl">
      {/* Header — gradient banner with meal slot name */}
      <div className="px-4 py-3" style={{ background: slotStyle.gradient }}>
        <p
          className="text-[10px] font-semibold uppercase tracking-widest opacity-70"
          style={{ color: slotStyle.label }}
        >
          Meal Idea
        </p>
        <p className="font-display text-base font-bold" style={{ color: slotStyle.accent }}>
          {meal.meal}
        </p>
      </div>

      {/* Body — menu items */}
      <div className="px-4 py-3">
        <ul className="space-y-1.5">
          {meal.items.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-[var(--text)]">
              <span
                className="mt-1.5 block h-1.5 w-1.5 shrink-0 rounded-full opacity-40"
                style={{ backgroundColor: slotStyle.accent }}
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        {/* Reasoning — subtle italic explanation */}
        <div className="prose-sm mt-3 border-t border-[var(--border)] pt-2.5 text-xs text-[var(--text-muted)] [&_em]:text-[var(--text-faint)] [&_strong]:text-[var(--text)]">
          <Markdown components={AI_MARKDOWN_COMPONENTS}>{meal.reasoning}</Markdown>
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

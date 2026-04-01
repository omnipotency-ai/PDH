/**
 * Shared test fixtures for AI analysis data.
 * Provides properly typed mock data matching the strict Convex validators.
 */

/** A minimal but fully typed AI analysis request for tests */
export const TEST_AI_REQUEST: {
  model: string;
  messages: Array<{ role: string; content: string }>;
} = {
  model: "gpt-5-mini",
  messages: [{ role: "user", content: "Test message" }],
};

/** A minimal AI response string for tests */
export const TEST_AI_RESPONSE = "Test response";

/** A minimal but fully typed AiNutritionistInsight for tests */
export const TEST_AI_INSIGHT: {
  directResponseToUser: string | null;
  summary: string;
  educationalInsight: { topic: string; fact: string } | null;
  foodAssessments: Array<{
    food: string;
    verdict: "safe" | "watch" | "avoid" | "trial_next";
    confidence: "high" | "medium" | "low";
    causalRole: "primary" | "possible" | "unlikely";
    changeType: "new" | "upgraded" | "downgraded" | "unchanged";
    modifierSummary: string;
    reasoning: string;
  }>;
  suspectedCulprits: Array<{
    food: string;
    confidence: "high" | "medium" | "low";
    reasoning: string;
  }>;
  mealPlan: Array<{
    meal: string;
    items: string[];
    reasoning: string;
  }>;
  suggestions: string[];
} = {
  directResponseToUser: null,
  summary: "Test summary",
  educationalInsight: null,
  foodAssessments: [],
  suspectedCulprits: [],
  mealPlan: [],
  suggestions: [],
};

/** An insight with food assessment data for extraction tests */
export const TEST_AI_INSIGHT_WITH_FOODS: typeof TEST_AI_INSIGHT = {
  ...TEST_AI_INSIGHT,
  foodAssessments: [
    {
      food: "Spicy Curry",
      verdict: "avoid",
      confidence: "high",
      causalRole: "primary",
      changeType: "new",
      modifierSummary: "No obvious confounders.",
      reasoning: "Caused issues",
    },
    {
      food: "Rice",
      verdict: "safe",
      confidence: "medium",
      causalRole: "unlikely",
      changeType: "unchanged",
      modifierSummary: "Outside the likely window.",
      reasoning: "Well tolerated",
    },
    {
      food: "Oatmeal",
      verdict: "trial_next",
      confidence: "medium",
      causalRole: "unlikely",
      changeType: "new",
      modifierSummary: "",
      reasoning: "Good fiber source. Timing: Tomorrow morning",
    },
  ],
  suspectedCulprits: [
    {
      food: "Spicy Curry",
      confidence: "high",
      reasoning: "Caused issues",
    },
  ],
  suggestions: ["Drink more water", "Try smaller meals"],
};

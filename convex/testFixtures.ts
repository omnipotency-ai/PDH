/**
 * Shared test fixtures for AI analysis data.
 * Provides properly typed mock data matching the strict Convex validators.
 */
import type { Infer } from "convex/values";
import type { aiInsightValidator, aiRequestValidator } from "./validators";

type TestAiRequest = Exclude<Infer<typeof aiRequestValidator>, null>;
type TestAiInsight = Exclude<Infer<typeof aiInsightValidator>, null>;

/** A minimal but fully typed AI analysis request for tests */
const TEST_AI_REQUEST_VALUE: TestAiRequest = {
  model: "gpt-5.4-mini",
  messages: [{ role: "user", content: "Test message" }],
};
Object.freeze(TEST_AI_REQUEST_VALUE.messages[0]);
Object.freeze(TEST_AI_REQUEST_VALUE.messages);
Object.freeze(TEST_AI_REQUEST_VALUE);
export const TEST_AI_REQUEST: TestAiRequest = TEST_AI_REQUEST_VALUE;

/** A minimal AI response string for tests */
export const TEST_AI_RESPONSE = "Test response";

/** A minimal but fully typed AiNutritionistInsight for tests */
const TEST_AI_INSIGHT_VALUE: TestAiInsight = {
  directResponseToUser: null,
  summary: "Test summary",
  educationalInsight: null,
  foodAssessments: [],
  suspectedCulprits: [],
  mealPlan: [],
  suggestions: [],
};
Object.freeze(TEST_AI_INSIGHT_VALUE.foodAssessments);
Object.freeze(TEST_AI_INSIGHT_VALUE.suspectedCulprits);
Object.freeze(TEST_AI_INSIGHT_VALUE.mealPlan);
Object.freeze(TEST_AI_INSIGHT_VALUE.suggestions);
Object.freeze(TEST_AI_INSIGHT_VALUE);
export const TEST_AI_INSIGHT: TestAiInsight = TEST_AI_INSIGHT_VALUE;

/** An insight with food assessment data for extraction tests */
const TEST_AI_INSIGHT_WITH_FOODS_VALUE: TestAiInsight = {
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
for (const assessment of TEST_AI_INSIGHT_WITH_FOODS_VALUE.foodAssessments ?? []) {
  Object.freeze(assessment);
}
for (const culprit of TEST_AI_INSIGHT_WITH_FOODS_VALUE.suspectedCulprits) {
  Object.freeze(culprit);
}
Object.freeze(TEST_AI_INSIGHT_WITH_FOODS_VALUE.foodAssessments);
Object.freeze(TEST_AI_INSIGHT_WITH_FOODS_VALUE.suspectedCulprits);
Object.freeze(TEST_AI_INSIGHT_WITH_FOODS_VALUE.suggestions);
Object.freeze(TEST_AI_INSIGHT_WITH_FOODS_VALUE);
export const TEST_AI_INSIGHT_WITH_FOODS: TestAiInsight = TEST_AI_INSIGHT_WITH_FOODS_VALUE;

import { describe, expect, it } from "vitest";
import {
  DEFAULT_INSIGHT_MODEL,
  getModelLabel,
  getValidInsightModel,
  INSIGHT_MODEL_OPTIONS,
} from "../aiModels";

describe("aiModels", () => {
  it("defaults insight model selection to gpt-5.4", () => {
    expect(DEFAULT_INSIGHT_MODEL).toBe("gpt-5.4");
    expect(INSIGHT_MODEL_OPTIONS).toEqual(["gpt-5.4", "gpt-5-mini"]);
  });

  it("maps legacy gpt-5.2 preferences to gpt-5.4", () => {
    expect(getValidInsightModel("gpt-5.2")).toBe("gpt-5.4");
    expect(getModelLabel("gpt-5.2")).toBe("GPT-5.4");
  });

  it("falls back invalid values to gpt-5.4", () => {
    expect(getValidInsightModel("gpt-4")).toBe("gpt-5.4");
    expect(getValidInsightModel(null)).toBe("gpt-5.4");
  });
});

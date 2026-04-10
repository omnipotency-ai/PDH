import { describe, expect, it } from "vitest";
import {
  AI_MODEL_OPTIONS,
  BACKGROUND_MODEL,
  DR_POO_MODEL,
  getValidAiModel,
} from "../aiModels";

describe("aiModels", () => {
  it("defaults developer-configured models to the expected fallbacks", () => {
    expect(DR_POO_MODEL).toBe("gpt-5.4");
    expect(BACKGROUND_MODEL).toBe("gpt-5.4-mini");
    expect(AI_MODEL_OPTIONS).toEqual(["gpt-5.4", "gpt-5.4-mini"]);
  });
  it("normalizes invalid and legacy model values", () => {
    expect(getValidAiModel("gpt-4")).toBe("gpt-5.4");
    expect(getValidAiModel("gpt-5.2")).toBe("gpt-5.4");
    expect(getValidAiModel("gpt-5-mini")).toBe("gpt-5.4-mini");
    expect(getValidAiModel(null)).toBe("gpt-5.4");
    expect(getValidAiModel(undefined, "gpt-5.4-mini")).toBe("gpt-5.4-mini");
    expect(getValidAiModel(null)).toBe("gpt-5.4");
  });
});

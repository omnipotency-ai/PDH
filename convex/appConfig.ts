import { query } from "./_generated/server";

function hasConfiguredOpenAiKey(): boolean {
  return (process.env.OPENAI_API_KEY?.trim() ?? "").length > 0;
}

export const hasAiConfigured = query({
  args: {},
  handler: async () => {
    return hasConfiguredOpenAiKey();
  },
});

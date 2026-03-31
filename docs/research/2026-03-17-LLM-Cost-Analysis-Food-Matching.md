# LLM Cost Analysis: Food Matching Pipeline

**Research date:** 2026-03-17
**Verified accurate as of:** 2026-03-17
**Context:** Research conducted for Caca Traca (anastomosis food reintegration tracker) Sprint 2.5, Wave 1.
**Purpose:** Evaluate LLM model pricing for food matching feature (BYOK, client-initiated)
**Use case:** Binary matching -- LLM either matches user food input to a registry canonical or returns "not found." No confidence scores.

---

## 1. OpenAI Models -- Pricing per 1M Tokens

| Model            | Input $/1M | Output $/1M | Cached Input $/1M | Context Window | Structured Output (JSON) | Notes                                                                    |
| ---------------- | ---------- | ----------- | ----------------- | -------------- | ------------------------ | ------------------------------------------------------------------------ |
| **gpt-4.1-nano** | $0.10      | $0.40       | $0.025            | 1M tokens      | Yes                      | Cheapest 4.1 family. Excels at classification, extraction, tool calling. |
| **gpt-5-nano**   | $0.05      | $0.40       | $0.005            | 400K tokens    | Yes                      | Cheapest overall OpenAI model. Good for summarization/classification.    |
| **gpt-4o-mini**  | $0.15      | $0.60       | ~$0.038           | 128K tokens    | Yes                      | Older but battle-tested. Being superseded by 4.1/5 mini.                 |
| **gpt-4.1-mini** | $0.40      | $1.60       | $0.10             | 1M tokens      | Yes                      | Good balance of cost/capability. Supports web search tool.               |
| **gpt-5-mini**   | $0.125     | $1.00       | N/A               | 400K tokens    | Yes                      | Released Aug 2025. Cheaper input than 4.1-mini but less context.         |
| **gpt-4.1**      | $2.00      | $8.00       | $0.50             | 1M tokens      | Yes                      | Full model. Overkill for food matching.                                  |
| **gpt-5**        | $1.25      | $10.00      | N/A               | 400K tokens    | Yes                      | Full model. Overkill for food matching.                                  |

**Key takeaway:** gpt-5-nano ($0.05/$0.40) and gpt-4.1-nano ($0.10/$0.40) are the cheapest options. Both support structured output/JSON mode and function calling.

---

## 2. OpenAI Web Search Models & Pricing

### Search Model Variants

| Model                      | Type                               | Per-1K Search Calls | Input $/1M | Output $/1M |
| -------------------------- | ---------------------------------- | ------------------- | ---------- | ----------- |
| gpt-4o-search-preview      | Chat Completions (always searches) | $25.00              | $2.50      | $10.00      |
| gpt-4o-mini-search-preview | Chat Completions (always searches) | $25.00              | $0.15      | $0.60       |
| gpt-5-search-api           | Chat Completions (always searches) | TBD                 | TBD        | TBD         |

### Web Search Tool (Responses API) -- Non-Preview

The **web_search** tool (generally available) can be added to any supported model via the Responses API. The model decides whether to search based on the prompt.

**Pricing structure has TWO components:**

1. **Tool call fee:** $10.00 per 1,000 web search calls (i.e., $0.01 per search)
2. **Search content tokens:** Tokens retrieved from the web, billed at the model's input token rate
   - For gpt-4o-mini and gpt-4.1-mini: charged as a **fixed block of 8,000 input tokens per call**
   - For other models: variable, billed at model's standard input rate

### Web Search Tool -- Model Compatibility

| Model                | Web Search Supported?                 |
| -------------------- | ------------------------------------- |
| gpt-4.1              | Yes                                   |
| gpt-4.1-mini         | Yes                                   |
| gpt-4.1-nano         | **NO**                                |
| gpt-4o / gpt-4o-mini | Yes                                   |
| gpt-5                | Partial (not with minimal reasoning)  |
| gpt-5-mini           | Likely yes (not explicitly confirmed) |
| gpt-5-nano           | **NOT confirmed**                     |

**Critical finding:** The cheapest models (nano variants) do NOT support OpenAI's integrated web search. Web search requires at least the mini tier.

### Cost of Web Search per Call (gpt-4.1-mini)

- Tool call fee: $0.01
- Search content tokens: 8,000 tokens x $0.40/1M = $0.0032
- Normal prompt tokens (650 tokens): $0.00026 input + $0.00016 output
- **Total per search call: ~$0.0136**
- Compare to base call without search: ~$0.00042

**Web search adds ~32x the cost of a base call.** This massively exceeds the 50% threshold.

---

## 3. Cost Estimate Per Food Matching Call

### Token Budget

| Component                                      | Tokens          |
| ---------------------------------------------- | --------------- |
| System prompt (registry subset + instructions) | ~500            |
| User input ("quelitas", "four lovely bananas") | ~50             |
| Response (JSON: canonical + reasoning)         | ~100            |
| **Total**                                      | **~650 tokens** |

Split: ~550 input tokens, ~100 output tokens.

### Cost Per Call by Model

| Model        | Input Cost (550 tokens) | Output Cost (100 tokens) | **Total/Call** | **Monthly (900 calls)** |
| ------------ | ----------------------- | ------------------------ | -------------- | ----------------------- |
| gpt-5-nano   | $0.0000275              | $0.0000400               | **$0.0000675** | **$0.061**              |
| gpt-4.1-nano | $0.0000550              | $0.0000400               | **$0.0000950** | **$0.086**              |
| gpt-4o-mini  | $0.0000825              | $0.0000600               | **$0.0001425** | **$0.128**              |
| gpt-5-mini   | $0.0000688              | $0.0001000               | **$0.0001688** | **$0.152**              |
| gpt-4.1-mini | $0.0002200              | $0.0001600               | **$0.0003800** | **$0.342**              |

### Cost Per Call WITH OpenAI Web Search (gpt-4.1-mini, cheapest search-capable)

| Component                                      | Cost         |
| ---------------------------------------------- | ------------ |
| Tool call fee ($10/1K calls)                   | $0.01000     |
| Search content tokens (8,000 x $0.40/1M)       | $0.00320     |
| Normal input tokens (550 x $0.40/1M)           | $0.00022     |
| Normal output tokens (100 x $1.60/1M)          | $0.00016     |
| **Total per search call**                      | **$0.01358** |
| **Monthly (900 calls, all with search)**       | **$12.22**   |
| **Monthly (900 calls, 30% need search = 270)** | **$3.97**    |

**Verdict:** OpenAI integrated web search is too expensive for this use case. Even at 30% search rate, it's $4/month vs $0.09/month for nano without search. The $0.01 per-call fee alone is 100x the cost of the base LLM call.

---

## 4. Alternative Search APIs (Free or Cheap)

| API                      | Free Tier                                      | Paid Pricing                    | Good for Food Lookup?              | Notes                                                                                            |
| ------------------------ | ---------------------------------------------- | ------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Tavily**               | 1,000 credits/month free (no CC needed)        | $0.008/credit (pay-as-you-go)   | Yes -- AI-optimized search results | Best free tier for our use case. 1 credit = 1 basic search. 1,000/month covers 900 calls easily. |
| **Brave Search**         | $5/month credit (~1,000 queries)               | $5/1,000 requests               | Yes                                | Good fallback. $5 credit may require payment method.                                             |
| **Google Custom Search** | 100 queries/day free (existing customers only) | $5/1,000 queries                | Yes                                | **Deprecated for new customers.** Sunset Jan 2027. Do not build on this.                         |
| **SerpAPI**              | 100 searches/month free                        | $75/month for 5,000             | Overkill                           | Expensive paid tier. Free tier too small.                                                        |
| **Perplexity API**       | No free tier (no credits at signup)            | $5/1,000 requests (Search API)  | Yes but expensive                  | Pro subscription gives only $5 API credit. Not economical.                                       |
| **DuckDuckGo**           | No official API                                | N/A (third-party scrapers only) | Not reliable                       | No official API. Community wrappers are fragile.                                                 |

### Recommended: Tavily

- **1,000 free searches/month** covers 900 calls with headroom
- No credit card required
- Returns AI-optimized search snippets (better than raw SERP)
- If exceeding free tier: $0.008/search = $7.20/month for 900 searches (still cheaper than OpenAI web search)

### Hybrid Architecture

```
User input: "quelitas"
    |
    v
[gpt-5-nano or gpt-4.1-nano] -- attempt match to registry
    |
    +-- MATCHED --> return canonical ("crispy crackers")
    |
    +-- NOT FOUND --> [Tavily Search: "what is quelitas food"]
                          |
                          v
                     [gpt-5-nano] -- match search result to registry
                          |
                          +-- MATCHED --> return canonical
                          +-- NOT FOUND --> return "unknown food"
```

**Cost for hybrid (assuming 30% need web search):**

- 900 nano calls: $0.061
- 270 Tavily searches: FREE (within 1,000/month)
- 270 second nano calls: $0.020
- **Total: ~$0.08/month** (essentially free)

---

## 5. Free LLM API Tiers

| Provider          | Free Tier                                                                                              | Best Cheap Model      | $/1M Input | $/1M Output | Structured Output? | Notes                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------ | --------------------- | ---------- | ----------- | ------------------ | -------------------------------------------------------------------------- |
| **OpenAI**        | Unclear -- may be discontinued for new accounts (mid-2025). If available: $5 credit, expires 3 months. | gpt-5-nano            | $0.05      | $0.40       | Yes                | Free tier may be limited to GPT-3.5 Turbo only.                            |
| **Google Gemini** | **Yes -- generous free tier.** All models free with rate limits (5-15 RPM, ~1,000 req/day).            | Gemini 2.5 Flash Lite | $0.10      | $0.40       | Yes                | Best free tier in the industry. Data used to improve Google products.      |
| **Groq**          | Yes -- free tier, no CC needed. Rate-limited.                                                          | Llama 3.1 8B          | ~$0.05     | ~$0.05      | Yes (JSON mode)    | Extremely fast inference. Free tier limits unknown but usable for testing. |
| **Together AI**   | $5-$100 credit at signup (varies)                                                                      | Various open models   | From $0.10 | From $0.10  | Yes                | Large model selection. Good for experimentation.                           |
| **Mistral**       | Yes -- free "experiment" tier. 1 RPS, 500K TPM, 1B tokens/month.                                       | Mistral Nemo          | $0.02      | $0.04       | Yes                | Cheapest paid model. Free tier extremely generous (1B tokens/month!).      |

### Standout Free Options

1. **Mistral (free tier):** 1 billion tokens/month free. At 650 tokens/call, that's ~1.5 million calls/month. More than enough forever. Rate limit of 1 RPS is fine for our use case (one user, sequential food logging).

2. **Google Gemini (free tier):** ~1,000 requests/day free. That's ~30,000/month. More than enough. Gemini 2.5 Flash Lite pricing matches gpt-4.1-nano when paid.

3. **Groq (free tier):** Free with rate limits. Llama models are solid for classification tasks. Speed is exceptional.

---

## 6. Recommendation

### Primary Model: gpt-4.1-nano or gpt-5-nano

| Factor                       | gpt-4.1-nano                      | gpt-5-nano                 |
| ---------------------------- | --------------------------------- | -------------------------- |
| Input $/1M                   | $0.10                             | $0.05                      |
| Output $/1M                  | $0.40                             | $0.40                      |
| Context Window               | 1M                                | 400K                       |
| Structured Output            | Yes                               | Yes                        |
| Classification Quality       | Excellent (instruction following) | Good (summarization focus) |
| **Monthly cost (900 calls)** | **$0.086**                        | **$0.061**                 |

**Recommendation: gpt-4.1-nano** for primary matching.

- Better instruction following and tool calling (critical for binary match/no-match)
- 1M context window allows sending larger registry subsets if needed
- $0.03/month more than gpt-5-nano is negligible
- Well-documented for classification and extraction tasks

### Web Search Strategy: Separate Search API (Tavily)

**Do NOT use OpenAI's integrated web search.** It costs $0.01+ per call vs $0.0001 for the base call -- a 100x multiplier, far exceeding the 50% cost threshold.

**Use Tavily for web search:**

- 1,000 free searches/month (no CC)
- Only trigger when nano model returns "not found"
- Expected 30% of calls need search = 270/month, well within free tier
- Feed search results back to gpt-4.1-nano for final matching

### Monthly Cost Estimate (Typical User)

| Component                            | Calls/Month | Cost              |
| ------------------------------------ | ----------- | ----------------- |
| gpt-4.1-nano (all 900 calls)         | 900         | $0.086            |
| Tavily search (30% = 270 calls)      | 270         | $0.00 (free tier) |
| gpt-4.1-nano (re-match after search) | 270         | $0.026            |
| **Total**                            |             | **~$0.11/month**  |

That is eleven cents per month. BYOK users pay this directly to OpenAI. Tavily's free tier covers the search needs entirely.

### Fallback if Budget is Tight

1. **First cut:** Use **Mistral free tier** (Mistral Nemo, $0.00/month) instead of OpenAI. 1 billion tokens/month free, 1 RPS rate limit. Quality may be slightly lower for obscure food matching but worth testing.

2. **Second cut:** Use **Google Gemini free tier** (Gemini 2.5 Flash Lite). ~1,000 requests/day free. Comparable quality to OpenAI nano models.

3. **Third cut:** Drop web search entirely. Users manually pick "other" category for unrecognized foods. Add search later when usage justifies it.

4. **Nuclear option:** Use Groq free tier (Llama 3.1 8B) + no web search. Completely free. May need prompt engineering to compensate for model quality.

### Architecture Decision

```
Tier 1 (Default):   gpt-4.1-nano ($0.11/month) + Tavily free search
Tier 2 (Free):      Mistral Nemo free tier + Tavily free search
Tier 3 (Minimal):   Any free LLM + no web search
```

The user's BYOK key determines which tier they're on. The app should support multiple providers.

---

## Sources

- [OpenAI Official Pricing](https://openai.com/api/pricing/)
- [OpenAI API Pricing Docs](https://developers.openai.com/api/docs/pricing/)
- [OpenAI Web Search Tool Docs](https://developers.openai.com/api/docs/guides/tools-web-search)
- [GPT-4.1 Nano Model Card](https://platform.openai.com/docs/models/gpt-4.1-nano)
- [GPT-5 Nano Model Card](https://developers.openai.com/api/docs/models/gpt-5-nano)
- [GPT-5 Mini Model Card](https://platform.openai.com/docs/models/gpt-5-mini)
- [GPT-4.1 Mini Model Card](https://developers.openai.com/api/docs/models/gpt-4.1-mini)
- [OpenAI Web Search Billing Discussion](https://community.openai.com/t/heads-up-web-search-tool-billing-can-be-higher-than-you-expect-here-s-why/1236954)
- [Tavily Pricing](https://docs.tavily.com/documentation/api-credits)
- [Brave Search API Pricing](https://api-dashboard.search.brave.com/documentation/pricing)
- [Perplexity API Pricing](https://docs.perplexity.ai/docs/getting-started/pricing)
- [SerpAPI Pricing](https://serpapi.com/pricing)
- [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Groq Pricing](https://groq.com/pricing)
- [Mistral Pricing](https://docs.mistral.ai/deployment/ai-studio/pricing)
- [Together AI Pricing](https://www.together.ai/pricing)
- [PE Collective: OpenAI API Pricing March 2026](https://pecollective.com/tools/openai-api-pricing/)
- [PricePerToken: OpenAI Models](https://pricepertoken.com/pricing-page/provider/openai)
- [GPT-4.1 Nano Pricing Guide](https://gptbreeze.io/blog/gpt-41-nano-pricing-guide/)
- [Free AI API Credits 2026](https://www.getaiperks.com/en/blogs/27-ai-api-free-tier-credits-2026)

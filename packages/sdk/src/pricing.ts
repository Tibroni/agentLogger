/** Rough USD per 1M tokens (input, output). Used for estimated_cost when providers omit billing. */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4-turbo": { input: 10, output: 30 },
  "gpt-4": { input: 30, output: 60 },
  "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
  "claude-3-5-sonnet": { input: 3, output: 15 },
  "claude-3-5-haiku": { input: 0.8, output: 4 },
  "claude-3-opus": { input: 15, output: 75 },
  "gemini-1.5-pro": { input: 1.25, output: 5 },
  "gemini-1.5-flash": { input: 0.075, output: 0.3 },
};

function normalizeModel(model?: string): string | undefined {
  if (!model) return undefined;
  return model.toLowerCase().replace(/^models\//, "");
}

export function estimateCost(options: {
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
}): number | undefined {
  const model = normalizeModel(options.model);
  if (!model) return undefined;

  const pricing =
    MODEL_PRICING[model] ??
    Object.entries(MODEL_PRICING).find(([key]) => model.includes(key))?.[1];
  if (!pricing) return undefined;

  const prompt = options.promptTokens ?? 0;
  const completion = options.completionTokens ?? 0;
  return (
    (prompt * pricing.input + completion * pricing.output) / 1_000_000
  );
}

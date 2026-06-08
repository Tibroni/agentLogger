/** Known defaults — used only for the optional “near context limit” hint, not for tracing. */
const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  "gpt-4o": 128_000,
  "gpt-4o-mini": 128_000,
  "gpt-4-turbo": 128_000,
  "gpt-4": 8_192,
  "gpt-3.5-turbo": 16_385,
  "claude-3-5-sonnet": 200_000,
  "claude-3-5-haiku": 200_000,
  "claude-3-opus": 200_000,
  "gemini-1.5-pro": 1_000_000,
  "gemini-1.5-flash": 1_000_000,
};

function normalizeModel(model?: string): string | undefined {
  if (!model) return undefined;
  return model.toLowerCase().replace(/^models\//, "");
}

/** User overrides via .env — e.g. AGENTLOGGER_CONTEXT_LIMITS=gpt-5=200000,llama-3=128000 */
function parseEnvContextLimits(): Record<string, number> {
  const raw = process.env.AGENTLOGGER_CONTEXT_LIMITS;
  if (!raw) return {};

  const limits: Record<string, number> = {};
  for (const part of raw.split(",")) {
    const [key, value] = part.split("=").map((s) => s.trim());
    const tokens = Number(value);
    if (key && Number.isFinite(tokens) && tokens > 0) {
      limits[normalizeModel(key) ?? key] = tokens;
    }
  }
  return limits;
}

export function getContextLimit(model?: string): number | undefined {
  const normalized = normalizeModel(model);
  if (!normalized) return undefined;

  const envLimits = parseEnvContextLimits();
  if (envLimits[normalized]) return envLimits[normalized];

  const envMatch = Object.entries(envLimits).find(([key]) =>
    normalized.includes(key)
  );
  if (envMatch) return envMatch[1];

  if (MODEL_CONTEXT_LIMITS[normalized]) return MODEL_CONTEXT_LIMITS[normalized];

  const knownMatch = Object.entries(MODEL_CONTEXT_LIMITS).find(([key]) =>
    normalized.includes(key)
  );
  if (knownMatch) return knownMatch[1];

  const defaultLimit = Number(process.env.AGENTLOGGER_DEFAULT_CONTEXT_LIMIT ?? 0);
  return defaultLimit > 0 ? defaultLimit : undefined;
}

/** Rough token estimate from JSON-serialized request body. */
export function estimateInputTokens(body: unknown): number | undefined {
  if (body == null) return undefined;
  try {
    const text = typeof body === "string" ? body : JSON.stringify(body);
    return Math.ceil(text.length / 4);
  } catch {
    return undefined;
  }
}

export function isNearContextLimit(options: {
  inputTokenEstimate?: number;
  contextLimit?: number;
  threshold?: number;
}): boolean {
  const { inputTokenEstimate, contextLimit } = options;
  if (inputTokenEstimate == null || contextLimit == null) return false;
  const threshold = options.threshold ?? 0.85;
  return inputTokenEstimate / contextLimit >= threshold;
}

const DEFAULT_LLM_HOSTS = [
  "api.openai.com",
  "api.anthropic.com",
  "generativelanguage.googleapis.com",
  "api.groq.com",
  "api.together.xyz",
  "api.mistral.ai",
  "api.cohere.com",
  "openrouter.ai",
  "localhost",
  "127.0.0.1",
];

export interface LlmDetection {
  isLlm: boolean;
  model?: string;
  host: string;
  streaming: boolean;
}

function parseExtraHosts(): string[] {
  const raw = process.env.AGENTLOGGER_LLM_HOSTS;
  if (!raw) return [];
  return raw.split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
}

function hostMatches(hostname: string): boolean {
  const host = hostname.toLowerCase();
  const hosts = [...DEFAULT_LLM_HOSTS, ...parseExtraHosts()];
  return hosts.some(
    (pattern) => host === pattern || host.endsWith(`.${pattern}`)
  );
}

function bodyLooksLikeLlm(body: unknown): boolean {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const record = body as Record<string, unknown>;

  const hasModel = typeof record.model === "string";
  const hasMessages =
    Array.isArray(record.messages) ||
    typeof record.prompt === "string" ||
    typeof record.input === "string" ||
    Array.isArray(record.contents) ||
    Array.isArray(record.input);

  const hasInferenceParams =
    record.max_tokens != null ||
    record.temperature != null ||
    record.stream != null;

  return hasModel && (hasMessages || hasInferenceParams);
}

export function detectLlmRequest(
  url: string | URL,
  init?: RequestInit,
  parsedBody?: unknown
): LlmDetection {
  let parsedUrl: URL;
  try {
    parsedUrl = typeof url === "string" ? new URL(url) : url;
  } catch {
    return { isLlm: false, host: "unknown", streaming: false };
  }

  const host = parsedUrl.hostname;
  const headers = init?.headers;
  const traceHeader =
    headers instanceof Headers
      ? headers.get("X-AgentLogger-Trace")
      : (headers as Record<string, string> | undefined)?.["X-AgentLogger-Trace"];

  if (traceHeader?.toLowerCase() === "llm") {
    const model =
      parsedBody && typeof parsedBody === "object" && !Array.isArray(parsedBody)
        ? ((parsedBody as Record<string, unknown>).model as string | undefined)
        : undefined;
    return {
      isLlm: true,
      model,
      host,
      streaming: isStreamingRequest(parsedBody),
    };
  }

  const hostMatch = hostMatches(host);
  const bodyMatch = parsedBody ? bodyLooksLikeLlm(parsedBody) : false;
  const isLocalHost = host === "localhost" || host === "127.0.0.1";

  const model =
    parsedBody && typeof parsedBody === "object" && !Array.isArray(parsedBody)
      ? ((parsedBody as Record<string, unknown>).model as string | undefined)
      : undefined;

  return {
    isLlm:
      bodyMatch ||
      (hostMatch && !isLocalHost && parsedBody == null),
    model,
    host,
    streaming: isStreamingRequest(parsedBody),
  };
}

function isStreamingRequest(body: unknown): boolean {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  return (body as Record<string, unknown>).stream === true;
}

export interface TokenUsage {
  totalTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
}

export function extractUsage(body: unknown): TokenUsage {
  if (!body || typeof body !== "object") return {};

  const record = body as Record<string, unknown>;
  const usage = record.usage as Record<string, number> | undefined;
  const usageMetadata = record.usageMetadata as
    | Record<string, number>
    | undefined;

  if (usage?.total_tokens != null) {
    return {
      totalTokens: usage.total_tokens,
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
    };
  }

  if (usage?.input_tokens != null || usage?.output_tokens != null) {
    const prompt = usage.input_tokens ?? 0;
    const completion = usage.output_tokens ?? 0;
    return {
      promptTokens: prompt,
      completionTokens: completion,
      totalTokens: prompt + completion,
    };
  }

  if (usageMetadata?.totalTokenCount != null) {
    return { totalTokens: usageMetadata.totalTokenCount };
  }

  const promptEval = record.prompt_eval_count as number | undefined;
  const evalCount = record.eval_count as number | undefined;
  if (promptEval != null || evalCount != null) {
    return { totalTokens: (promptEval ?? 0) + (evalCount ?? 0) };
  }

  return {};
}

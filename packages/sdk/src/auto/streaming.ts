import { extractAssistantText, extractUsage, type TokenUsage } from "./detect.js";

export interface StreamParseResult {
  text: string;
  usage?: TokenUsage;
}

/** Parse OpenAI / Anthropic style SSE chunks from accumulated stream text. */
export function parseSseStream(accumulated: string): StreamParseResult {
  let text = "";
  let usage: TokenUsage | undefined;

  for (const line of accumulated.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;

    try {
      const json = JSON.parse(payload) as Record<string, unknown>;

      // OpenAI delta
      const choices = json.choices as
        | Array<{ delta?: { content?: string }; message?: { content?: string } }>
        | undefined;
      const delta = choices?.[0]?.delta?.content ?? choices?.[0]?.message?.content;
      if (typeof delta === "string") text += delta;

      // Anthropic delta
      const anthropicDelta = json.delta as { text?: string } | undefined;
      if (typeof anthropicDelta?.text === "string") text += anthropicDelta.text;

      const chunkUsage = extractUsage(json);
      if (chunkUsage.totalTokens != null) usage = chunkUsage;
    } catch {
      // ignore malformed SSE lines
    }
  }

  if (!text) {
    const fallback = extractAssistantText(
      accumulated.startsWith("{") ? JSON.parse(accumulated) : { stream: accumulated }
    );
    if (fallback) text = fallback;
  }

  return { text: text.trim(), usage };
}

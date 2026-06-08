import { ensureAutoRun } from "../auto/lifecycle.js";
import { runInContextAsync } from "../auto/context.js";
import { extractAssistantText, extractUsage } from "../auto/detect.js";
import { estimateCost } from "../pricing.js";
import { getContextLimit, estimateInputTokens } from "../context-window.js";
import { scheduleAutoRunEnd } from "../auto/lifecycle.js";

export interface OpenAiClientLike {
  chat?: {
    completions?: {
      create: (params: Record<string, unknown>) => Promise<unknown>;
    };
  };
}

/**
 * Wrap OpenAI SDK chat.completions.create for Agent Logger tracing.
 */
export async function traceOpenAiChatCompletion(
  client: OpenAiClientLike,
  params: Record<string, unknown>
): Promise<unknown> {
  const model = typeof params.model === "string" ? params.model : "openai";
  const ctx = ensureAutoRun();
  const inputEstimate = estimateInputTokens(params);
  const contextLimit = getContextLimit(model);

  const step = ctx.run.startStep({
    type: "llm",
    name: model,
    input: {
      ...params,
      input_token_estimate: inputEstimate,
      context_limit: contextLimit,
    },
  });

  try {
    const create = client.chat?.completions?.create;
    if (!create) throw new Error("OpenAI client missing chat.completions.create");

    const result = await runInContextAsync(ctx, () => create(params));
    const usage = extractUsage(result);
    const estimatedCost = estimateCost({
      model,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
    });

    step.end({
      output: result,
      usage: {
        ...usage,
        model,
        provider: "api.openai.com",
        estimatedCost,
        contextLimit,
        inputTokenEstimate: inputEstimate,
      },
    });

    ctx.run.recordUsage({
      ...usage,
      model,
      provider: "api.openai.com",
    });

    const text = extractAssistantText(result);
    if (text) scheduleAutoRunEnd(text);

    return result;
  } catch (error) {
    step.fail({ error: error instanceof Error ? error : String(error) });
    throw error;
  }
}

import { ensureAutoRun } from "../auto/lifecycle.js";
import { runInContextAsync } from "../auto/context.js";
import { estimateCost } from "../pricing.js";
import { getContextLimit, estimateInputTokens } from "../context-window.js";

export interface VercelAiTraceOptions {
  model?: string;
  provider?: string;
  prompt?: unknown;
}

/**
 * Wrap Vercel AI SDK generateText / streamText calls for Agent Logger tracing.
 */
export async function traceVercelAiCall<T>(
  options: VercelAiTraceOptions,
  fn: () => Promise<T>
): Promise<T> {
  const ctx = ensureAutoRun();
  const inputEstimate = estimateInputTokens(options.prompt);
  const contextLimit = getContextLimit(options.model);

  const step = ctx.run.startStep({
    type: "llm",
    name: options.model ?? "vercel-ai",
    input: {
      provider: options.provider ?? "vercel-ai",
      model: options.model,
      prompt: options.prompt,
      input_token_estimate: inputEstimate,
      context_limit: contextLimit,
    },
  });

  const startMs = Date.now();
  try {
    const result = await runInContextAsync(ctx, fn);
    const record = result as Record<string, unknown>;
    const text =
      typeof record.text === "string"
        ? record.text
        : typeof record.content === "string"
          ? record.content
          : undefined;
    const usage = record.usage as
      | { promptTokens?: number; completionTokens?: number; totalTokens?: number }
      | undefined;

    const promptTokens = usage?.promptTokens;
    const completionTokens = usage?.completionTokens;
    const totalTokens =
      usage?.totalTokens ??
      (promptTokens != null && completionTokens != null
        ? promptTokens + completionTokens
        : undefined);
    const estimatedCost = estimateCost({
      model: options.model,
      promptTokens,
      completionTokens,
    });

    step.end({
      output: result,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens,
        model: options.model,
        provider: options.provider ?? "vercel-ai",
        estimatedCost,
        contextLimit,
        inputTokenEstimate: inputEstimate,
      },
    });

    if (totalTokens != null || options.model) {
      ctx.run.recordUsage({
        promptTokens,
        completionTokens,
        totalTokens,
        model: options.model,
        provider: options.provider ?? "vercel-ai",
      });
    }

    void startMs;
    if (text) {
      const { scheduleAutoRunEnd } = await import("../auto/lifecycle.js");
      scheduleAutoRunEnd(text);
    }

    return result;
  } catch (error) {
    step.fail({ error: error instanceof Error ? error : String(error) });
    throw error;
  }
}

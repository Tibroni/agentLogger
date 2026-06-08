import { ensureAutoRun } from "../auto/lifecycle.js";
import { runInContextAsync } from "../auto/context.js";

export interface LangChainToolLike {
  name: string;
  invoke: (input: unknown) => Promise<unknown>;
}

/**
 * Wrap a LangChain-style tool invoke for Agent Logger tracing.
 */
export async function traceLangChainTool(
  tool: LangChainToolLike,
  input: unknown
): Promise<unknown> {
  const ctx = ensureAutoRun();
  const startMs = Date.now();
  try {
    const result = await runInContextAsync(ctx, () => tool.invoke(input));
    ctx.run.logToolCall({
      toolName: tool.name,
      input,
      output: result,
      success: true,
      durationMs: Date.now() - startMs,
    });
    return result;
  } catch (error) {
    ctx.run.logToolCall({
      toolName: tool.name,
      input,
      output: error instanceof Error ? error.message : String(error),
      success: false,
      durationMs: Date.now() - startMs,
    });
    throw error;
  }
}

export interface LangChainLlmLike {
  invoke: (input: unknown) => Promise<unknown>;
}

/**
 * Wrap a LangChain-style LLM invoke for Agent Logger tracing.
 */
export async function traceLangChainLlm(
  name: string,
  llm: LangChainLlmLike,
  input: unknown
): Promise<unknown> {
  const ctx = ensureAutoRun();
  const step = ctx.run.startStep({
    type: "llm",
    name,
    input,
  });

  try {
    const result = await runInContextAsync(ctx, () => llm.invoke(input));
    step.end({ output: result });
    return result;
  } catch (error) {
    step.fail({ error: error instanceof Error ? error : String(error) });
    throw error;
  }
}

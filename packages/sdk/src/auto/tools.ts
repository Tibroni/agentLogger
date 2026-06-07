import { ensureAutoRun } from "./lifecycle.js";
import { runInContextAsync } from "./context.js";

export type ToolFn = (...args: unknown[]) => unknown;

export function wrapTool<T extends ToolFn>(name: string, fn: T): T {
  const wrapped = (async (...args: Parameters<T>) => {
    const ctx = ensureAutoRun();
    const startMs = Date.now();
    try {
      const result = await runInContextAsync(ctx, () =>
        Promise.resolve(fn(...args))
      );
      ctx.run.logToolCall({
        toolName: name,
        input: args.length === 1 ? args[0] : args,
        output: result,
        success: true,
        durationMs: Date.now() - startMs,
      });
      return result;
    } catch (error) {
      ctx.run.logToolCall({
        toolName: name,
        input: args.length === 1 ? args[0] : args,
        output: error instanceof Error ? error.message : String(error),
        success: false,
        durationMs: Date.now() - startMs,
      });
      throw error;
    }
  }) as T;

  return wrapped;
}

export function instrumentTools<T extends Record<string, ToolFn>>(tools: T): T {
  const wrapped = {} as T;
  for (const [name, fn] of Object.entries(tools)) {
    if (typeof fn === "function") {
      (wrapped as Record<string, ToolFn>)[name] = wrapTool(name, fn);
    }
  }
  return wrapped;
}

export { instrumentTools as default };

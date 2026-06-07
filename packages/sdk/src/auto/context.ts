import { AsyncLocalStorage } from "async_hooks";
import type { AgentRun } from "../index.js";

export interface RunContext {
  run: AgentRun;
  manual: boolean;
  ending: boolean;
}

export const runContextStorage = new AsyncLocalStorage<RunContext>();

export function getActiveRunContext(): RunContext | undefined {
  return runContextStorage.getStore();
}

export function runInContext<T>(ctx: RunContext, fn: () => T): T {
  return runContextStorage.run(ctx, fn);
}

export async function runInContextAsync<T>(
  ctx: RunContext,
  fn: () => Promise<T>
): Promise<T> {
  return runContextStorage.run(ctx, fn);
}

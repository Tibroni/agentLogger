import {
  getActiveRunContext,
  runInContext,
  runInContextAsync,
  type RunContext,
} from "./context.js";
import { startRun, type AgentRun } from "../index.js";

let processRunContext: RunContext | null = null;

function defaultUserInput(): string {
  return (
    process.env.AGENTLOGGER_USER_INPUT ??
    `auto-run ${new Date().toISOString()}`
  );
}

export function ensureAutoRun(userInput?: string): RunContext {
  const existing = getActiveRunContext();
  if (existing) return existing;

  if (processRunContext && !processRunContext.ending) {
    return processRunContext;
  }

  const run = startRun({
    userInput: userInput ?? defaultUserInput(),
    metadata: { auto_instrumented: true },
  });

  processRunContext = { run, manual: false, ending: false };
  return processRunContext;
}

export async function endAutoRun(options?: {
  status?: "success" | "error";
  finalOutput?: string;
}): Promise<void> {
  if (!processRunContext || processRunContext.ending) return;

  processRunContext.ending = true;
  try {
    await processRunContext.run.end({
      status: options?.status ?? "success",
      finalOutput: options?.finalOutput,
    });
  } finally {
    processRunContext = null;
  }
}

export function withAutoRun<T>(fn: (run: AgentRun) => T): T {
  const ctx = ensureAutoRun();
  return runInContext(ctx, () => fn(ctx.run));
}

export async function withAutoRunAsync<T>(
  fn: (run: AgentRun) => Promise<T>
): Promise<T> {
  const ctx = ensureAutoRun();
  return runInContextAsync(ctx, () => fn(ctx.run));
}

export function resetLifecycleForTests(): void {
  processRunContext = null;
}

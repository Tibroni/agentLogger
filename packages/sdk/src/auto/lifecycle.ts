import {
  getActiveRunContext,
  runInContext,
  runInContextAsync,
  type RunContext,
} from "./context.js";
import { startRun, type AgentRun } from "../index.js";

let processRunContext: RunContext | null = null;
let idleEndTimer: ReturnType<typeof setTimeout> | null = null;
let pendingFinalOutput: string | undefined;

const AUTO_RUN_IDLE_MS = Number(process.env.AGENTLOGGER_AUTO_END_IDLE_MS ?? 1000);

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

export function hasAutoRunEndScheduled(): boolean {
  return idleEndTimer != null;
}

export function clearAutoRunEndTimer(): void {
  if (!idleEndTimer) return;
  clearTimeout(idleEndTimer);
  idleEndTimer = null;
}

/** End the auto run after a quiet period (scripts exit before beforeExit can flush). */
export function scheduleAutoRunEnd(finalOutput?: string): void {
  if (finalOutput) pendingFinalOutput = finalOutput;
  clearAutoRunEndTimer();
  idleEndTimer = setTimeout(() => {
    idleEndTimer = null;
    void endAutoRun({ status: "success", finalOutput: pendingFinalOutput });
  }, AUTO_RUN_IDLE_MS);
}

export async function endAutoRun(options?: {
  status?: "success" | "error";
  finalOutput?: string;
}): Promise<void> {
  clearAutoRunEndTimer();
  if (!processRunContext || processRunContext.ending) return;

  processRunContext.ending = true;
  try {
    await processRunContext.run.end({
      status: options?.status ?? "success",
      finalOutput: options?.finalOutput ?? pendingFinalOutput,
    });
  } finally {
    pendingFinalOutput = undefined;
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
  clearAutoRunEndTimer();
  pendingFinalOutput = undefined;
  processRunContext = null;
}

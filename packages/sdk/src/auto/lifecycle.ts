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

function createRunContext(userInput?: string, metadata?: Record<string, unknown>): RunContext {
  const run = startRun({
    userInput: userInput ?? defaultUserInput(),
    metadata: { auto_instrumented: true, ...metadata },
  });
  return { run, manual: false, ending: false };
}

/** Script-mode singleton run (reused when no ALS context exists). */
export function ensureAutoRun(userInput?: string): RunContext {
  const existing = getActiveRunContext();
  if (existing && !existing.ending) return existing;

  if (processRunContext && !processRunContext.ending) {
    return processRunContext;
  }

  processRunContext = createRunContext(userInput);
  return processRunContext;
}

/** Per-request / per-task isolated run (does not share process singleton). */
export function createIsolatedRun(
  userInput?: string,
  metadata?: Record<string, unknown>
): RunContext {
  return createRunContext(userInput, metadata);
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

export async function endIsolatedRun(
  ctx: RunContext,
  options?: {
    status?: "success" | "error";
    finalOutput?: string;
  }
): Promise<void> {
  if (ctx.ending) return;
  ctx.ending = true;
  try {
    await ctx.run.end({
      status: options?.status ?? "success",
      finalOutput: options?.finalOutput,
    });
  } finally {
    if (processRunContext === ctx) {
      processRunContext = null;
    }
  }
}

export async function endAutoRun(options?: {
  status?: "success" | "error";
  finalOutput?: string;
}): Promise<void> {
  clearAutoRunEndTimer();
  const ctx = getActiveRunContext() ?? processRunContext;
  if (!ctx || ctx.ending) return;

  ctx.ending = true;
  try {
    await ctx.run.end({
      status: options?.status ?? "success",
      finalOutput: options?.finalOutput ?? pendingFinalOutput,
    });
  } finally {
    pendingFinalOutput = undefined;
    if (processRunContext === ctx) {
      processRunContext = null;
    }
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

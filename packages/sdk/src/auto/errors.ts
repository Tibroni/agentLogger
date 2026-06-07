import { getActiveRunContext } from "./context.js";
import { ensureAutoRun, endAutoRun } from "./lifecycle.js";

let errorHandlersRegistered = false;

export function registerErrorHandlers(): void {
  if (errorHandlersRegistered) return;
  errorHandlersRegistered = true;

  process.on("uncaughtException", (error) => {
    void handleFatalError(error);
  });

  process.on("unhandledRejection", (reason) => {
    void handleFatalError(reason);
  });
}

async function handleFatalError(error: unknown): Promise<void> {
  const ctx = getActiveRunContext();
  if (!ctx || ctx.ending) return;

  ctx.ending = true;
  const message = error instanceof Error ? error.message : String(error);
  try {
    await ctx.run.end({ status: "error", finalOutput: message });
  } catch {
    /* fail-open */
  }
}

export function resetErrorHandlersForTests(): void {
  errorHandlersRegistered = false;
}

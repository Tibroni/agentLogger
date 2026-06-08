import { autoInit } from "./init.js";
import { patchFetch } from "./fetch.js";
import { registerErrorHandlers } from "./errors.js";
import { endAutoRun, hasAutoRunEndScheduled } from "./lifecycle.js";

let enabled = false;

export function enableAutoInstrumentation(): void {
  if (enabled) return;
  enabled = true;

  autoInit();
  patchFetch();
  registerErrorHandlers();

  process.on("beforeExit", () => {
    if (hasAutoRunEndScheduled()) return;
    void endAutoRun().catch(() => undefined);
  });
}

export function isAutoInstrumentationEnabled(): boolean {
  return enabled;
}

export function resetAutoInstrumentationForTests(): void {
  enabled = false;
}

export { autoInit } from "./init.js";
export { wrapTool, instrumentTools } from "./tools.js";
export {
  ensureAutoRun,
  createIsolatedRun,
  endAutoRun,
  endIsolatedRun,
  withAutoRun,
  withAutoRunAsync,
} from "./lifecycle.js";

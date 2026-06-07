import { enableAutoInstrumentation } from "./instrument.js";

enableAutoInstrumentation();

export {
  enableAutoInstrumentation,
  isAutoInstrumentationEnabled,
  resetAutoInstrumentationForTests,
  autoInit,
  wrapTool,
  instrumentTools,
  ensureAutoRun,
  endAutoRun,
  withAutoRun,
  withAutoRunAsync,
} from "./instrument.js";

export type { AutoInitOptions } from "./init.js";
export type { ToolFn } from "./tools.js";

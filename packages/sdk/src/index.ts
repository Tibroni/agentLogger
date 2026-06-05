import { randomUUID } from "crypto";
import type {
  IngestBatchV1,
  Run,
  RunStatus,
  Step,
  ToolCall,
} from "@agentlogger/core";

export interface InitOptions {
  apiKey?: string;
  baseUrl?: string;
  projectId: string;
  environment?: string;
}

export interface StartRunOptions {
  userInput: string;
  metadata?: Record<string, unknown>;
}

export interface StartStepOptions {
  type: string;
  name: string;
  input?: unknown;
}

export interface EndStepOptions {
  output?: unknown;
}

export interface FailStepOptions {
  error: string | Error;
}

export interface LogToolCallOptions {
  toolName: string;
  input: unknown;
  output?: unknown;
  success: boolean;
  durationMs?: number;
  stepId?: string;
}

export interface EndRunOptions {
  finalOutput?: string;
  status?: RunStatus;
  tokens?: number;
  cost?: number;
}

export interface AgentRun {
  runId: string;
  startStep(options: StartStepOptions): AgentStep;
  logToolCall(options: LogToolCallOptions): void;
  end(options?: EndRunOptions): Promise<void>;
}

export interface AgentStep {
  stepId: string;
  end(options?: EndStepOptions): void;
  fail(options: FailStepOptions): void;
}

interface SdkConfig {
  apiKey: string;
  baseUrl: string;
  projectId: string;
  environment: string;
}

let config: SdkConfig | null = null;

const pendingRuns: Run[] = [];
const pendingSteps: Step[] = [];
const pendingToolCalls: ToolCall[] = [];

export function init(options: InitOptions): void {
  config = {
    apiKey:
      options.apiKey ??
      process.env.OBSERVABILITY_API_KEY ??
      "dev-api-key-change-me",
    baseUrl:
      options.baseUrl ??
      process.env.OBSERVABILITY_URL ??
      "http://localhost:3000",
    projectId: options.projectId,
    environment: options.environment ?? "development",
  };
}

export function getConfig(): SdkConfig {
  if (!config) {
    throw new Error(
      "AgentLogger SDK not initialized. Call init() before tracing."
    );
  }
  return config;
}

export function resetForTests(): void {
  config = null;
  pendingRuns.length = 0;
  pendingSteps.length = 0;
  pendingToolCalls.length = 0;
}

export function getPendingBatch(): IngestBatchV1 {
  return {
    runs: pendingRuns.length ? [...pendingRuns] : undefined,
    steps: pendingSteps.length ? [...pendingSteps] : undefined,
    toolCalls: pendingToolCalls.length ? [...pendingToolCalls] : undefined,
  };
}

export function clearPendingBatch(): void {
  pendingRuns.length = 0;
  pendingSteps.length = 0;
  pendingToolCalls.length = 0;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function flush(): Promise<void> {
  const batch = getPendingBatch();
  if (
    !batch.runs?.length &&
    !batch.steps?.length &&
    !batch.toolCalls?.length
  ) {
    return;
  }

  const { apiKey, baseUrl } = getConfig();
  const url = `${baseUrl.replace(/\/$/, "")}/api/v1/ingest`;

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(batch),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Ingest failed (${response.status}): ${text}`);
      }

      clearPendingBatch();
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        await sleep(2 ** attempt * 100);
      }
    }
  }

  throw lastError;
}

export function startRun(options: StartRunOptions): AgentRun {
  const { projectId, environment } = getConfig();
  const runId = randomUUID();
  const startTime = new Date().toISOString();

  const runRecord: Run = {
    run_id: runId,
    project_id: projectId,
    environment,
    user_input: options.userInput,
    start_time: startTime,
    status: "running",
    metadata: options.metadata,
  };

  pendingRuns.push(runRecord);

  const updateRunRecord = (updates: Partial<Run>) => {
    Object.assign(runRecord, updates);
    const index = pendingRuns.findIndex((r) => r.run_id === runId);
    if (index >= 0) {
      pendingRuns[index] = { ...runRecord, ...updates };
    }
  };

  return {
    runId,

    startStep(stepOptions: StartStepOptions): AgentStep {
      const stepId = randomUUID();
      const stepRecord: Step = {
        step_id: stepId,
        run_id: runId,
        step_type: stepOptions.type,
        step_name: stepOptions.name,
        input_payload: stepOptions.input,
        timestamp: new Date().toISOString(),
      };
      pendingSteps.push(stepRecord);

      const finalizeStep = (updates: Partial<Step>) => {
        Object.assign(stepRecord, updates);
        const index = pendingSteps.findIndex((s) => s.step_id === stepId);
        if (index >= 0) {
          pendingSteps[index] = { ...stepRecord, ...updates };
        }
      };

      return {
        stepId,
        end(endOptions?: EndStepOptions) {
          const endTime = Date.now();
          const startMs = new Date(stepRecord.timestamp).getTime();
          finalizeStep({
            output_payload: endOptions?.output,
            duration_ms: endTime - startMs,
          });
        },
        fail(failOptions: FailStepOptions) {
          const endTime = Date.now();
          const startMs = new Date(stepRecord.timestamp).getTime();
          const errorMessage =
            failOptions.error instanceof Error
              ? failOptions.error.message
              : failOptions.error;
          finalizeStep({
            error_message: errorMessage,
            duration_ms: endTime - startMs,
          });
        },
      };
    },

    logToolCall(toolOptions: LogToolCallOptions): void {
      const toolCall: ToolCall = {
        tool_call_id: randomUUID(),
        run_id: runId,
        step_id: toolOptions.stepId,
        tool_name: toolOptions.toolName,
        input: toolOptions.input,
        output: toolOptions.output,
        success: toolOptions.success,
        duration_ms: toolOptions.durationMs,
        timestamp: new Date().toISOString(),
      };
      pendingToolCalls.push(toolCall);
    },

    async end(endOptions?: EndRunOptions): Promise<void> {
      const endTime = new Date();
      const startMs = new Date(runRecord.start_time).getTime();
      const totalLatency = endTime.getTime() - startMs;

      updateRunRecord({
        end_time: endTime.toISOString(),
        total_latency: totalLatency,
        total_tokens: endOptions?.tokens,
        total_cost: endOptions?.cost,
        status: endOptions?.status ?? "success",
        final_output: endOptions?.finalOutput,
      });

      await flush();
    },
  };
}

export async function withRun<T>(
  options: StartRunOptions,
  fn: (run: AgentRun) => Promise<T>
): Promise<T> {
  const run = startRun(options);
  try {
    const result = await fn(run);
    await run.end({ status: "success", finalOutput: String(result) });
    return result;
  } catch (error) {
    await run.end({
      status: "error",
      finalOutput: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

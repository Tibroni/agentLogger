import type { Run, Step, ToolCall, Evaluation, RunStatus } from "@agentlogger/core";

export function serializeJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function parseJson<T = unknown>(value: string | null | undefined): T | null {
  if (value == null) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

type RunRow = {
  run_id: string;
  project_id: string;
  environment: string;
  user_input: string;
  start_time: Date;
  end_time: Date | null;
  total_latency: number | null;
  total_tokens: number | null;
  total_cost: number | null;
  status: string;
  final_output: string | null;
  parent_run_id: string | null;
  root_run_id: string | null;
  metadata: string | null;
};

type StepRow = {
  step_id: string;
  run_id: string;
  step_type: string;
  step_name: string;
  input_payload: string | null;
  output_payload: string | null;
  timestamp: Date;
  duration_ms: number | null;
  error_message: string | null;
  parent_step_id: string | null;
  attempt: number | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  model: string | null;
  provider: string | null;
  estimated_cost: number | null;
  context_limit: number | null;
  input_token_estimate: number | null;
  time_to_first_token_ms: number | null;
};

export function runToDto(run: RunRow) {
  return {
    run_id: run.run_id,
    project_id: run.project_id,
    environment: run.environment,
    user_input: run.user_input,
    start_time: run.start_time.toISOString(),
    end_time: run.end_time?.toISOString(),
    total_latency: run.total_latency ?? undefined,
    total_tokens: run.total_tokens ?? undefined,
    total_cost: run.total_cost ?? undefined,
    status: run.status as RunStatus,
    final_output: run.final_output ?? undefined,
    parent_run_id: run.parent_run_id ?? undefined,
    root_run_id: run.root_run_id ?? undefined,
    metadata: parseJson<Record<string, unknown>>(run.metadata) ?? undefined,
  } satisfies Run;
}

export function stepToDto(step: StepRow) {
  return {
    step_id: step.step_id,
    run_id: step.run_id,
    step_type: step.step_type,
    step_name: step.step_name,
    input_payload: parseJson(step.input_payload) ?? undefined,
    output_payload: parseJson(step.output_payload) ?? undefined,
    timestamp: step.timestamp.toISOString(),
    duration_ms: step.duration_ms ?? undefined,
    error_message: step.error_message ?? undefined,
    parent_step_id: step.parent_step_id ?? undefined,
    attempt: step.attempt ?? undefined,
    prompt_tokens: step.prompt_tokens ?? undefined,
    completion_tokens: step.completion_tokens ?? undefined,
    total_tokens: step.total_tokens ?? undefined,
    model: step.model ?? undefined,
    provider: step.provider ?? undefined,
    estimated_cost: step.estimated_cost ?? undefined,
    context_limit: step.context_limit ?? undefined,
    input_token_estimate: step.input_token_estimate ?? undefined,
    time_to_first_token_ms: step.time_to_first_token_ms ?? undefined,
  } satisfies Step;
}

export function toolCallToDto(toolCall: {
  tool_call_id: string;
  run_id: string;
  step_id: string | null;
  tool_name: string;
  input: string;
  output: string | null;
  success: boolean;
  duration_ms: number | null;
  timestamp: Date;
}) {
  return {
    tool_call_id: toolCall.tool_call_id,
    run_id: toolCall.run_id,
    step_id: toolCall.step_id ?? undefined,
    tool_name: toolCall.tool_name,
    input: parseJson(toolCall.input) ?? {},
    output: parseJson(toolCall.output) ?? undefined,
    success: toolCall.success,
    duration_ms: toolCall.duration_ms ?? undefined,
    timestamp: toolCall.timestamp.toISOString(),
  } satisfies ToolCall;
}

export function evaluationToDto(evaluation: {
  evaluation_id: string;
  run_id: string;
  eval_type: string;
  score: number | null;
  rubric_name: string | null;
  reviewer: string | null;
  comments: string | null;
  created_at: Date;
}) {
  return {
    evaluation_id: evaluation.evaluation_id,
    run_id: evaluation.run_id,
    eval_type: evaluation.eval_type as "manual" | "automated",
    score: evaluation.score ?? undefined,
    rubric_name: evaluation.rubric_name ?? undefined,
    reviewer: evaluation.reviewer ?? undefined,
    comments: evaluation.comments ?? undefined,
    created_at: evaluation.created_at.toISOString(),
  } satisfies Evaluation;
}

export function runDetailToExport(run: RunRow & {
  steps: StepRow[];
  toolCalls: Array<{
    tool_call_id: string;
    run_id: string;
    step_id: string | null;
    tool_name: string;
    input: string;
    output: string | null;
    success: boolean;
    duration_ms: number | null;
    timestamp: Date;
  }>;
  evaluations: Array<{
    evaluation_id: string;
    run_id: string;
    eval_type: string;
    score: number | null;
    rubric_name: string | null;
    reviewer: string | null;
    comments: string | null;
    created_at: Date;
  }>;
}) {
  return {
    run: runToDto(run),
    steps: run.steps.map(stepToDto),
    toolCalls: run.toolCalls.map(toolCallToDto),
    evaluations: run.evaluations.map(evaluationToDto),
  };
}

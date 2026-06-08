import { z } from "zod";

export const RunStatusSchema = z.enum(["running", "success", "error"]);
export type RunStatus = z.infer<typeof RunStatusSchema>;

export const JsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(JsonValueSchema),
  ])
);

export const RunSchema = z.object({
  run_id: z.string().uuid(),
  project_id: z.string().min(1),
  environment: z.string().min(1),
  user_input: z.string(),
  start_time: z.string().datetime(),
  end_time: z.string().datetime().optional(),
  total_latency: z.number().nonnegative().optional(),
  total_tokens: z.number().int().nonnegative().optional(),
  total_cost: z.number().nonnegative().optional(),
  status: RunStatusSchema,
  final_output: z.string().optional(),
  parent_run_id: z.string().uuid().optional(),
  root_run_id: z.string().uuid().optional(),
  metadata: z.record(JsonValueSchema).optional(),
});

export type Run = z.infer<typeof RunSchema>;

export const StepSchema = z.object({
  step_id: z.string().uuid(),
  run_id: z.string().uuid(),
  step_type: z.string().min(1),
  step_name: z.string().min(1),
  input_payload: JsonValueSchema.optional(),
  output_payload: JsonValueSchema.optional(),
  timestamp: z.string().datetime(),
  duration_ms: z.number().nonnegative().optional(),
  error_message: z.string().optional(),
  parent_step_id: z.string().uuid().optional(),
  attempt: z.number().int().positive().optional(),
  prompt_tokens: z.number().int().nonnegative().optional(),
  completion_tokens: z.number().int().nonnegative().optional(),
  total_tokens: z.number().int().nonnegative().optional(),
  model: z.string().optional(),
  provider: z.string().optional(),
  estimated_cost: z.number().nonnegative().optional(),
  context_limit: z.number().int().nonnegative().optional(),
  input_token_estimate: z.number().int().nonnegative().optional(),
  time_to_first_token_ms: z.number().nonnegative().optional(),
});

export type Step = z.infer<typeof StepSchema>;

export const ToolCallSchema = z.object({
  tool_call_id: z.string().uuid(),
  run_id: z.string().uuid(),
  step_id: z.string().uuid().optional(),
  tool_name: z.string().min(1),
  input: JsonValueSchema,
  output: JsonValueSchema.optional(),
  success: z.boolean(),
  duration_ms: z.number().nonnegative().optional(),
  timestamp: z.string().datetime(),
});

export type ToolCall = z.infer<typeof ToolCallSchema>;

export const EvaluationSchema = z.object({
  evaluation_id: z.string().uuid(),
  run_id: z.string().uuid(),
  eval_type: z.enum(["manual", "automated"]),
  score: z.number().min(0).max(1).optional(),
  rubric_name: z.string().optional(),
  reviewer: z.string().optional(),
  comments: z.string().optional(),
  created_at: z.string().datetime(),
});

export type Evaluation = z.infer<typeof EvaluationSchema>;

export const IngestBatchV1Schema = z
  .object({
    runs: z.array(RunSchema).optional(),
    steps: z.array(StepSchema).optional(),
    toolCalls: z.array(ToolCallSchema).optional(),
    evaluations: z.array(EvaluationSchema).optional(),
  })
  .refine(
    (data) =>
      (data.runs?.length ?? 0) +
        (data.steps?.length ?? 0) +
        (data.toolCalls?.length ?? 0) +
        (data.evaluations?.length ?? 0) >
      0,
    { message: "At least one event must be provided" }
  );

export type IngestBatchV1 = z.infer<typeof IngestBatchV1Schema>;

export const CreateEvaluationSchema = z.object({
  eval_type: z.enum(["manual", "automated"]).default("manual"),
  score: z.number().min(0).max(1).optional(),
  rubric_name: z.string().optional(),
  reviewer: z.string().optional(),
  comments: z.string().optional(),
});

export type CreateEvaluation = z.infer<typeof CreateEvaluationSchema>;

export const RunListQuerySchema = z.object({
  project_id: z.string().optional(),
  environment: z.string().optional(),
  status: RunStatusSchema.optional(),
  run_id: z.string().optional(),
  search: z.string().optional(),
  tag: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export const RunCompareQuerySchema = z.object({
  a: z.string().uuid(),
  b: z.string().uuid(),
  project_id: z.string().optional(),
});

export type RunListQuery = z.infer<typeof RunListQuerySchema>;
export type RunCompareQuery = z.infer<typeof RunCompareQuerySchema>;

export function parseIngestBatch(data: unknown): IngestBatchV1 {
  return IngestBatchV1Schema.parse(data);
}

export function safeParseIngestBatch(data: unknown) {
  return IngestBatchV1Schema.safeParse(data);
}

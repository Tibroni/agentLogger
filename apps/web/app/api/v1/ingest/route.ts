import { NextRequest } from "next/server";
import { parseIngestBatch } from "@agentlogger/core";
import { prisma } from "@/lib/prisma";
import { serializeJson } from "@/lib/serialize";
import {
  validateApiKey,
  unauthorizedResponse,
  badRequestResponse,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  if (!validateApiKey(request)) {
    return unauthorizedResponse();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequestResponse("Invalid JSON body");
  }

  let batch;
  try {
    batch = parseIngestBatch(body);
  } catch (error) {
    return badRequestResponse("Validation failed", error);
  }

  await prisma.$transaction(async (tx) => {
    if (batch.runs?.length) {
      for (const run of batch.runs) {
        await tx.run.upsert({
          where: { run_id: run.run_id },
          create: {
            run_id: run.run_id,
            project_id: run.project_id,
            environment: run.environment,
            user_input: run.user_input,
            start_time: new Date(run.start_time),
            end_time: run.end_time ? new Date(run.end_time) : null,
            total_latency: run.total_latency ?? null,
            total_tokens: run.total_tokens ?? null,
            total_cost: run.total_cost ?? null,
            status: run.status,
            final_output: run.final_output ?? null,
            parent_run_id: run.parent_run_id ?? null,
            root_run_id: run.root_run_id ?? null,
            metadata: run.metadata ? serializeJson(run.metadata) : null,
          },
          update: {
            end_time: run.end_time ? new Date(run.end_time) : null,
            total_latency: run.total_latency ?? null,
            total_tokens: run.total_tokens ?? null,
            total_cost: run.total_cost ?? null,
            status: run.status,
            final_output: run.final_output ?? null,
            parent_run_id: run.parent_run_id ?? null,
            root_run_id: run.root_run_id ?? null,
            metadata: run.metadata ? serializeJson(run.metadata) : null,
          },
        });
      }
    }

    if (batch.steps?.length) {
      for (const step of batch.steps) {
        await tx.step.upsert({
          where: { step_id: step.step_id },
          create: {
            step_id: step.step_id,
            run_id: step.run_id,
            step_type: step.step_type,
            step_name: step.step_name,
            input_payload:
              step.input_payload != null
                ? serializeJson(step.input_payload)
                : null,
            output_payload:
              step.output_payload != null
                ? serializeJson(step.output_payload)
                : null,
            timestamp: new Date(step.timestamp),
            duration_ms: step.duration_ms ?? null,
            error_message: step.error_message ?? null,
            parent_step_id: step.parent_step_id ?? null,
            attempt: step.attempt ?? null,
            prompt_tokens: step.prompt_tokens ?? null,
            completion_tokens: step.completion_tokens ?? null,
            total_tokens: step.total_tokens ?? null,
            model: step.model ?? null,
            provider: step.provider ?? null,
            estimated_cost: step.estimated_cost ?? null,
            context_limit: step.context_limit ?? null,
            input_token_estimate: step.input_token_estimate ?? null,
            time_to_first_token_ms: step.time_to_first_token_ms ?? null,
          },
          update: {
            output_payload:
              step.output_payload != null
                ? serializeJson(step.output_payload)
                : null,
            duration_ms: step.duration_ms ?? null,
            error_message: step.error_message ?? null,
            parent_step_id: step.parent_step_id ?? null,
            attempt: step.attempt ?? null,
            prompt_tokens: step.prompt_tokens ?? null,
            completion_tokens: step.completion_tokens ?? null,
            total_tokens: step.total_tokens ?? null,
            model: step.model ?? null,
            provider: step.provider ?? null,
            estimated_cost: step.estimated_cost ?? null,
            context_limit: step.context_limit ?? null,
            input_token_estimate: step.input_token_estimate ?? null,
            time_to_first_token_ms: step.time_to_first_token_ms ?? null,
          },
        });
      }
    }

    if (batch.toolCalls?.length) {
      for (const toolCall of batch.toolCalls) {
        await tx.toolCall.upsert({
          where: { tool_call_id: toolCall.tool_call_id },
          create: {
            tool_call_id: toolCall.tool_call_id,
            run_id: toolCall.run_id,
            step_id: toolCall.step_id ?? null,
            tool_name: toolCall.tool_name,
            input: serializeJson(toolCall.input),
            output:
              toolCall.output != null ? serializeJson(toolCall.output) : null,
            success: toolCall.success,
            duration_ms: toolCall.duration_ms ?? null,
            timestamp: new Date(toolCall.timestamp),
          },
          update: {
            output:
              toolCall.output != null ? serializeJson(toolCall.output) : null,
            success: toolCall.success,
            duration_ms: toolCall.duration_ms ?? null,
          },
        });
      }
    }

    if (batch.evaluations?.length) {
      for (const evaluation of batch.evaluations) {
        await tx.evaluation.upsert({
          where: { evaluation_id: evaluation.evaluation_id },
          create: {
            evaluation_id: evaluation.evaluation_id,
            run_id: evaluation.run_id,
            eval_type: evaluation.eval_type,
            score: evaluation.score ?? null,
            rubric_name: evaluation.rubric_name ?? null,
            reviewer: evaluation.reviewer ?? null,
            comments: evaluation.comments ?? null,
            created_at: new Date(evaluation.created_at),
          },
          update: {
            score: evaluation.score ?? null,
            rubric_name: evaluation.rubric_name ?? null,
            reviewer: evaluation.reviewer ?? null,
            comments: evaluation.comments ?? null,
          },
        });
      }
    }
  });

  return Response.json({ accepted: true }, { status: 202 });
}

import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { CreateEvaluationSchema } from "@agentlogger/core";
import { prisma } from "@/lib/prisma";
import { evaluationToDto } from "@/lib/serialize";
import {
  validateApiKey,
  unauthorizedResponse,
  badRequestResponse,
} from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  if (!validateApiKey(request)) {
    return unauthorizedResponse();
  }

  const { runId } = await params;

  const run = await prisma.run.findUnique({ where: { run_id: runId } });
  if (!run) {
    return Response.json({ error: "Run not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequestResponse("Invalid JSON body");
  }

  const parsed = CreateEvaluationSchema.safeParse(body);
  if (!parsed.success) {
    return badRequestResponse("Validation failed", parsed.error.flatten());
  }

  const evaluation = await prisma.evaluation.create({
    data: {
      evaluation_id: randomUUID(),
      run_id: runId,
      eval_type: parsed.data.eval_type,
      score: parsed.data.score ?? null,
      rubric_name: parsed.data.rubric_name ?? null,
      reviewer: parsed.data.reviewer ?? null,
      comments: parsed.data.comments ?? null,
      created_at: new Date(),
    },
  });

  return Response.json(evaluationToDto(evaluation), { status: 201 });
}

import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { runDetailToExport, evaluationToDto } from "@/lib/serialize";
import { runAutomatedEvaluation } from "@/lib/auto-evaluate";
import {
  validateApiKey,
  unauthorizedResponse,
} from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  if (!validateApiKey(request)) {
    return unauthorizedResponse();
  }

  const { runId } = await params;

  const run = await prisma.run.findUnique({
    where: { run_id: runId },
    include: {
      steps: { orderBy: { timestamp: "asc" } },
      toolCalls: { orderBy: { timestamp: "asc" } },
      evaluations: { orderBy: { created_at: "desc" } },
    },
  });

  if (!run) {
    return Response.json({ error: "Run not found" }, { status: 404 });
  }

  const detail = runDetailToExport(run);
  const result = runAutomatedEvaluation(detail);
  const evaluationId = randomUUID();

  const evaluation = await prisma.evaluation.create({
    data: {
      evaluation_id: evaluationId,
      run_id: runId,
      eval_type: "automated",
      score: result.score,
      rubric_name: result.rubric_name,
      reviewer: result.reviewer,
      comments: result.comments,
      created_at: new Date(),
    },
  });

  return Response.json({ evaluation: evaluationToDto(evaluation) }, { status: 201 });
}

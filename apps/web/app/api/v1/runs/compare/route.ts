import { NextRequest } from "next/server";
import { RunCompareQuerySchema } from "@agentlogger/core";
import { prisma } from "@/lib/prisma";
import { runDetailToExport } from "@/lib/serialize";
import { badRequestResponse } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = RunCompareQuerySchema.safeParse(params);

  if (!parsed.success) {
    return badRequestResponse("Invalid query parameters", parsed.error.flatten());
  }

  const { a, b, project_id } = parsed.data;

  const [runA, runB] = await Promise.all([
    prisma.run.findUnique({
      where: { run_id: a },
      include: {
        steps: { orderBy: { timestamp: "asc" } },
        toolCalls: { orderBy: { timestamp: "asc" } },
        evaluations: { orderBy: { created_at: "desc" } },
      },
    }),
    prisma.run.findUnique({
      where: { run_id: b },
      include: {
        steps: { orderBy: { timestamp: "asc" } },
        toolCalls: { orderBy: { timestamp: "asc" } },
        evaluations: { orderBy: { created_at: "desc" } },
      },
    }),
  ]);

  if (!runA || !runB) {
    return Response.json({ error: "One or both runs not found" }, { status: 404 });
  }

  if (project_id && (runA.project_id !== project_id || runB.project_id !== project_id)) {
    return Response.json({ error: "Runs do not belong to the requested project" }, { status: 403 });
  }

  const detailA = runDetailToExport(runA);
  const detailB = runDetailToExport(runB);

  const summary = {
    latency_delta:
      (runA.total_latency ?? 0) - (runB.total_latency ?? 0),
    tokens_delta: (runA.total_tokens ?? 0) - (runB.total_tokens ?? 0),
    cost_delta: (runA.total_cost ?? 0) - (runB.total_cost ?? 0),
    status_match: runA.status === runB.status,
    output_changed: runA.final_output !== runB.final_output,
    step_count_a: runA.steps.length,
    step_count_b: runB.steps.length,
    error_count_a: runA.steps.filter((s) => s.error_message).length,
    error_count_b: runB.steps.filter((s) => s.error_message).length,
  };

  return Response.json({
    a: detailA,
    b: detailB,
    summary,
  });
}

import { NextRequest } from "next/server";
import { RunListQuerySchema } from "@agentlogger/core";
import { prisma } from "@/lib/prisma";
import { runToDto } from "@/lib/serialize";
import { badRequestResponse } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = RunListQuerySchema.safeParse(params);

  if (!parsed.success) {
    return badRequestResponse("Invalid query parameters", parsed.error.flatten());
  }

  const { project_id, environment, status, run_id, from, to, limit, offset } =
    parsed.data;

  const where: {
    project_id?: string;
    environment?: string;
    status?: string;
    run_id?: { startsWith: string };
    start_time?: { gte?: Date; lte?: Date };
  } = {};

  if (project_id) where.project_id = project_id;
  if (environment) where.environment = environment;
  if (status) where.status = status;
  if (run_id) where.run_id = { startsWith: run_id };
  if (from || to) {
    where.start_time = {};
    if (from) where.start_time.gte = new Date(from);
    if (to) where.start_time.lte = new Date(to);
  }

  const [runs, total, aggregates] = await Promise.all([
    prisma.run.findMany({
      where,
      orderBy: { start_time: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.run.count({ where }),
    prisma.run.aggregate({
      where,
      _avg: { total_latency: true, total_cost: true },
      _count: { _all: true },
    }),
  ]);

  const errorCount = await prisma.run.count({
    where: { ...where, status: "error" },
  });

  return Response.json({
    runs: runs.map(runToDto),
    total,
    metrics: {
      avg_latency: aggregates._avg.total_latency ?? 0,
      avg_cost: aggregates._avg.total_cost ?? 0,
      total_runs: aggregates._count._all,
      error_count: errorCount,
    },
    limit,
    offset,
  });
}

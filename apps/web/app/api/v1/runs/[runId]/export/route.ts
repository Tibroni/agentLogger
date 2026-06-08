import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { runDetailToExport } from "@/lib/serialize";

function toJsonl(exportData: ReturnType<typeof runDetailToExport>): string {
  const lines = [
    JSON.stringify({ type: "run", ...exportData.run }),
    ...exportData.steps.map((step) =>
      JSON.stringify({ type: "step", ...step })
    ),
    ...exportData.toolCalls.map((tool) =>
      JSON.stringify({ type: "tool_call", ...tool })
    ),
    ...exportData.evaluations.map((evaluation) =>
      JSON.stringify({ type: "evaluation", ...evaluation })
    ),
  ];
  return `${lines.join("\n")}\n`;
}

function toOtel(exportData: ReturnType<typeof runDetailToExport>): object {
  const { run, steps } = exportData;
  const startNs = new Date(run.start_time).getTime() * 1_000_000;
  const endNs = run.end_time
    ? new Date(run.end_time).getTime() * 1_000_000
    : startNs + (run.total_latency ?? 0) * 1_000_000;

  return {
    resourceSpans: [
      {
        resource: {
          attributes: [
            { key: "service.name", value: { stringValue: run.project_id } },
            { key: "deployment.environment", value: { stringValue: run.environment } },
          ],
        },
        scopeSpans: [
          {
            scope: { name: "agentlogger" },
            spans: [
              {
                traceId: run.root_run_id ?? run.run_id,
                spanId: run.run_id.replace(/-/g, "").slice(0, 16),
                name: "agent.run",
                kind: 1,
                startTimeUnixNano: String(startNs),
                endTimeUnixNano: String(endNs),
                attributes: [
                  { key: "run.status", value: { stringValue: run.status } },
                  { key: "run.user_input", value: { stringValue: run.user_input } },
                  ...(run.final_output
                    ? [{ key: "run.final_output", value: { stringValue: run.final_output } }]
                    : []),
                ],
                events: steps.map((step) => ({
                  name: step.step_name,
                  timeUnixNano: String(new Date(step.timestamp).getTime() * 1_000_000),
                  attributes: [
                    { key: "step.type", value: { stringValue: step.step_type } },
                    ...(step.model
                      ? [{ key: "llm.model", value: { stringValue: step.model } }]
                      : []),
                    ...(step.total_tokens != null
                      ? [{ key: "llm.tokens", value: { intValue: step.total_tokens } }]
                      : []),
                  ],
                })),
              },
            ],
          },
        ],
      },
    ],
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const format = request.nextUrl.searchParams.get("format") ?? "json";

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

  const exportData = runDetailToExport(run);

  if (format === "json") {
    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="run-${runId}.json"`,
      },
    });
  }

  if (format === "jsonl") {
    return new Response(toJsonl(exportData), {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Content-Disposition": `attachment; filename="run-${runId}.jsonl"`,
      },
    });
  }

  if (format === "otel") {
    return new Response(JSON.stringify(toOtel(exportData), null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="run-${runId}.otel.json"`,
      },
    });
  }

  return Response.json({ error: "Unsupported format. Use json, jsonl, or otel." }, { status: 400 });
}

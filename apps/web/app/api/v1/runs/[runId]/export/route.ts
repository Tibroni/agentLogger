import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { runDetailToExport } from "@/lib/serialize";

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

  return Response.json({ error: "Unsupported format" }, { status: 400 });
}

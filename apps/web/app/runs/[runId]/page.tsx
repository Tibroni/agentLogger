import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { runDetailToExport } from "@/lib/serialize";
import {
  getDashboardProjectId,
  assertRunBelongsToProject,
} from "@/lib/project";
import { RunDetailView } from "@/components/RunDetailView";
import { EvaluationForm } from "@/components/EvaluationForm";
import { runsListHref } from "@/lib/project-client";

export default async function RunDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ runId: string }>;
  searchParams: Promise<{ project_id?: string }>;
}) {
  const { runId } = await params;
  const query = await searchParams;
  const activeProjectId =
    query.project_id?.trim() || getDashboardProjectId();
  const backHref = runsListHref(activeProjectId ?? "");

  const run = await prisma.run.findUnique({
    where: { run_id: runId },
    include: {
      steps: { orderBy: { timestamp: "asc" } },
      toolCalls: { orderBy: { timestamp: "asc" } },
      evaluations: { orderBy: { created_at: "desc" } },
    },
  });

  if (!run || !assertRunBelongsToProject(run.project_id, activeProjectId)) {
    return (
      <div className="space-y-4">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to runs
        </Link>
        <p className="text-zinc-400">
          Run not found{activeProjectId ? ` for project "${activeProjectId}"` : ""}.
        </p>
      </div>
    );
  }

  const detail = runDetailToExport(run);
  const exportQuery = activeProjectId
    ? `?format=json&project_id=${encodeURIComponent(activeProjectId)}`
    : "?format=json";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to runs
        </Link>
        <a
          href={`/api/v1/runs/${runId}/export${exportQuery}`}
          className="inline-flex items-center gap-2 rounded-lg border border-surface-border px-3 py-1.5 text-sm hover:bg-surface-raised"
        >
          <Download className="h-4 w-4" />
          Export JSON
        </a>
      </div>
      <RunDetailView detail={detail} />
      <EvaluationForm runId={runId} evaluations={detail.evaluations} />
    </div>
  );
}

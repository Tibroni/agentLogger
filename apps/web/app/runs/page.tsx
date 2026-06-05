"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, RefreshCw } from "lucide-react";
import {
  resolveActiveProjectId,
  persistProjectId,
  runDetailHref,
} from "@/lib/project-client";

interface RunSummary {
  run_id: string;
  project_id: string;
  environment: string;
  user_input: string;
  start_time: string;
  end_time?: string;
  total_latency?: number;
  total_cost?: number;
  status: string;
  final_output?: string;
}

interface RunsResponse {
  runs: RunSummary[];
  total: number;
  metrics: {
    avg_latency: number;
    avg_cost: number;
    total_runs: number;
    error_count: number;
  };
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    success: "bg-emerald-500/20 text-emerald-400",
    error: "bg-red-500/20 text-red-400",
    running: "bg-amber-500/20 text-amber-400",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? "bg-zinc-500/20 text-zinc-400"}`}
    >
      {status}
    </span>
  );
}

function ProjectSetupRequired() {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6">
      <h2 className="text-lg font-semibold text-amber-200">Set your project ID</h2>
      <p className="mt-2 text-sm text-zinc-300">
        The dashboard only shows traces for one project at a time. Set{" "}
        <code className="rounded bg-black/30 px-1">NEXT_PUBLIC_OBSERVABILITY_PROJECT_ID</code> in{" "}
        <code className="rounded bg-black/30 px-1">apps/web/.env</code> to the same value as{" "}
        <code className="rounded bg-black/30 px-1">projectId</code> in your SDK{" "}
        <code className="rounded bg-black/30 px-1">init()</code>, then restart the dashboard.
      </p>
      <p className="mt-3 text-sm text-zinc-400">
        Or open{" "}
        <code className="rounded bg-black/30 px-1">/runs?project_id=your-project-id</code>
      </p>
    </div>
  );
}

function RunsPageContent() {
  const searchParams = useSearchParams();
  const projectId = resolveActiveProjectId(searchParams.get("project_id"));

  const [data, setData] = useState<RunsResponse | null>(null);
  const [runIdFilter, setRunIdFilter] = useState("");
  const [fromFilter, setFromFilter] = useState("");
  const [toFilter, setToFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (projectId) persistProjectId(projectId);
  }, [projectId]);

  const fetchRuns = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      setData(null);
      return;
    }

    setLoading(true);
    const params = new URLSearchParams();
    params.set("project_id", projectId);
    if (runIdFilter) params.set("run_id", runIdFilter);
    if (fromFilter) params.set("from", new Date(fromFilter).toISOString());
    if (toFilter) params.set("to", new Date(toFilter).toISOString());

    const response = await fetch(`/api/v1/runs?${params.toString()}`);
    const json = (await response.json()) as RunsResponse;
    setData(json);
    setLoading(false);
  }, [projectId, runIdFilter, fromFilter, toFilter]);

  useEffect(() => {
    void fetchRuns();
  }, [fetchRuns]);

  if (!projectId) {
    return <ProjectSetupRequired />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Runs</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Showing project <span className="font-mono text-zinc-300">{projectId}</span> only
          </p>
        </div>
        <button
          onClick={() => void fetchRuns()}
          className="inline-flex items-center gap-2 rounded-lg border border-surface-border px-3 py-1.5 text-sm hover:bg-surface-raised"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {data?.metrics && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <MetricCard label="Total runs" value={String(data.metrics.total_runs)} />
          <MetricCard
            label="Avg latency"
            value={`${Math.round(data.metrics.avg_latency)}ms`}
          />
          <MetricCard
            label="Avg cost"
            value={`$${data.metrics.avg_cost.toFixed(4)}`}
          />
          <MetricCard label="Errors" value={String(data.metrics.error_count)} />
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Filter by run ID..."
            value={runIdFilter}
            onChange={(e) => setRunIdFilter(e.target.value)}
            className="rounded-lg border border-surface-border bg-surface-raised py-2 pl-9 pr-3 text-sm outline-none focus:border-accent"
          />
        </div>
        <input
          type="datetime-local"
          value={fromFilter}
          onChange={(e) => setFromFilter(e.target.value)}
          className="rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <input
          type="datetime-local"
          value={toFilter}
          onChange={(e) => setToFilter(e.target.value)}
          className="rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-surface-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-raised text-zinc-400">
            <tr>
              <th className="px-4 py-3 font-medium">Run ID</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Latency</th>
              <th className="px-4 py-3 font-medium">Cost</th>
              <th className="px-4 py-3 font-medium">Started</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                  Loading...
                </td>
              </tr>
            ) : data?.runs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                  No runs for this project yet. Run your agent with the same projectId in the SDK.
                </td>
              </tr>
            ) : (
              data?.runs.map((run) => (
                <tr
                  key={run.run_id}
                  className="border-t border-surface-border hover:bg-surface-raised/50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={runDetailHref(run.run_id, projectId)}
                      className="font-mono text-xs text-accent-muted hover:underline"
                    >
                      {run.run_id.slice(0, 8)}...
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={run.status} />
                  </td>
                  <td className="px-4 py-3">
                    {run.total_latency != null
                      ? `${Math.round(run.total_latency)}ms`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {run.total_cost != null
                      ? `$${run.total_cost.toFixed(4)}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {new Date(run.start_time).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function RunsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-zinc-500">Loading runs...</div>
      }
    >
      <RunsPageContent />
    </Suspense>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

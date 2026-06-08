"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, RefreshCw, GitCompare } from "lucide-react";
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
  total_tokens?: number;
  total_cost?: number;
  status: string;
  final_output?: string;
  latest_eval_score?: number;
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
        Set{" "}
        <code className="rounded bg-black/30 px-1">AGENTLOGGER_PROJECT_ID</code> in your
        agent&apos;s <code className="rounded bg-black/30 px-1">.env</code>, then open{" "}
        <code className="rounded bg-black/30 px-1">/runs?project_id=your-project-id</code>
      </p>
    </div>
  );
}

function RunsPageContent() {
  const searchParams = useSearchParams();
  const projectId = resolveActiveProjectId(searchParams.get("project_id"));

  const [data, setData] = useState<RunsResponse | null>(null);
  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [runIdFilter, setRunIdFilter] = useState("");
  const [fromFilter, setFromFilter] = useState("");
  const [toFilter, setToFilter] = useState("");
  const [compareA, setCompareA] = useState("");
  const [compareB, setCompareB] = useState("");
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
    if (searchFilter) params.set("search", searchFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (runIdFilter) params.set("run_id", runIdFilter);
    if (fromFilter) params.set("from", new Date(fromFilter).toISOString());
    if (toFilter) params.set("to", new Date(toFilter).toISOString());

    const response = await fetch(`/api/v1/runs?${params.toString()}`);
    const json = (await response.json()) as RunsResponse;
    setData(json);
    setLoading(false);
  }, [projectId, searchFilter, statusFilter, runIdFilter, fromFilter, toFilter]);

  useEffect(() => {
    void fetchRuns();
  }, [fetchRuns]);

  useEffect(() => {
    const hasRunning = data?.runs.some((r) => r.status === "running");
    if (!hasRunning) return;
    const interval = setInterval(() => void fetchRuns(), 3000);
    return () => clearInterval(interval);
  }, [data?.runs, fetchRuns]);

  if (!projectId) {
    return <ProjectSetupRequired />;
  }

  const compareHref =
    compareA && compareB
      ? `/runs/compare?a=${compareA}&b=${compareB}&project_id=${encodeURIComponent(projectId)}`
      : null;

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
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search input, output, metadata..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full rounded-lg border border-surface-border bg-surface-raised py-2 pl-9 pr-3 text-sm outline-none focus:border-accent"
          />
        </div>
        <input
          type="text"
          placeholder="Run ID prefix..."
          value={runIdFilter}
          onChange={(e) => setRunIdFilter(e.target.value)}
          className="rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="">All statuses</option>
          <option value="running">Running</option>
          <option value="success">Success</option>
          <option value="error">Error</option>
        </select>
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

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-surface-border bg-surface-raised p-3">
        <GitCompare className="h-4 w-4 text-zinc-500" />
        <input
          type="text"
          placeholder="Run A ID"
          value={compareA}
          onChange={(e) => setCompareA(e.target.value)}
          className="min-w-[120px] flex-1 rounded border border-surface-border bg-black/20 px-2 py-1 font-mono text-xs"
        />
        <span className="text-zinc-500">vs</span>
        <input
          type="text"
          placeholder="Run B ID"
          value={compareB}
          onChange={(e) => setCompareB(e.target.value)}
          className="min-w-[120px] flex-1 rounded border border-surface-border bg-black/20 px-2 py-1 font-mono text-xs"
        />
        {compareHref ? (
          <Link
            href={compareHref}
            className="rounded-lg bg-accent px-3 py-1 text-sm font-medium text-white hover:opacity-90"
          >
            Compare
          </Link>
        ) : (
          <span className="text-xs text-zinc-500">Enter two run IDs to compare</span>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-surface-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-raised text-zinc-400">
            <tr>
              <th className="px-4 py-3 font-medium">Run ID</th>
              <th className="px-4 py-3 font-medium">Input</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Latency</th>
              <th className="px-4 py-3 font-medium">Tokens</th>
              <th className="px-4 py-3 font-medium">Cost</th>
              <th className="px-4 py-3 font-medium">Eval</th>
              <th className="px-4 py-3 font-medium">Started</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-zinc-500">
                  Loading...
                </td>
              </tr>
            ) : data?.runs.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-zinc-500">
                  No runs for this project yet.
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
                  <td className="max-w-[200px] truncate px-4 py-3 text-zinc-400">
                    {run.user_input}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={run.status} />
                  </td>
                  <td className="px-4 py-3">
                    {run.total_latency != null
                      ? `${Math.round(run.total_latency)}ms`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">{run.total_tokens ?? "—"}</td>
                  <td className="px-4 py-3">
                    {run.total_cost != null
                      ? `$${run.total_cost.toFixed(4)}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {run.latest_eval_score != null
                      ? `${(run.latest_eval_score * 100).toFixed(0)}%`
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

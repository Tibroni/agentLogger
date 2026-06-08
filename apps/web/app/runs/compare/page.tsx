"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { resolveActiveProjectId, runsListHref } from "@/lib/project-client";
import type { RunDetailData } from "@/components/RunDetailView";

interface CompareResponse {
  a: RunDetailData;
  b: RunDetailData;
  summary: {
    latency_delta: number;
    tokens_delta: number;
    cost_delta: number;
    status_match: boolean;
    output_changed: boolean;
    step_count_a: number;
    step_count_b: number;
    error_count_a: number;
    error_count_b: number;
  };
}

function CompareContent() {
  const searchParams = useSearchParams();
  const projectId = resolveActiveProjectId(searchParams.get("project_id"));
  const runA = searchParams.get("a") ?? "";
  const runB = searchParams.get("b") ?? "";
  const [data, setData] = useState<CompareResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runA || !runB) return;
    const params = new URLSearchParams({ a: runA, b: runB });
    if (projectId) params.set("project_id", projectId);
    void fetch(`/api/v1/runs/compare?${params}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json()) as { error?: string };
          throw new Error(body.error ?? "Compare failed");
        }
        return res.json() as Promise<CompareResponse>;
      })
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, [runA, runB, projectId]);

  const backHref = runsListHref(projectId ?? "");

  if (!runA || !runB) {
    return (
      <p className="text-zinc-400">
        Provide two run IDs: /runs/compare?a=...&b=...
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to runs
      </Link>

      <h1 className="text-2xl font-bold">Run comparison</h1>

      {error && <p className="text-red-400">{error}</p>}
      {!data && !error && <p className="text-zinc-500">Loading comparison...</p>}

      {data && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Metric label="Latency Δ" value={`${Math.round(data.summary.latency_delta)}ms`} />
            <Metric label="Tokens Δ" value={String(data.summary.tokens_delta)} />
            <Metric label="Cost Δ" value={`$${data.summary.cost_delta.toFixed(4)}`} />
            <Metric
              label="Status match"
              value={data.summary.status_match ? "Yes" : "No"}
            />
            <Metric
              label="Output changed"
              value={data.summary.output_changed ? "Yes" : "No"}
            />
            <Metric
              label="Steps A / B"
              value={`${data.summary.step_count_a} / ${data.summary.step_count_b}`}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <RunCard title="Run A" detail={data.a} />
            <RunCard title="Run B" detail={data.b} />
          </div>

          <div className="rounded-xl border border-surface-border bg-surface-raised p-6">
            <h2 className="mb-3 font-semibold">Output diff</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <pre className="max-h-64 overflow-auto rounded-lg bg-black/30 p-3 text-xs text-zinc-300 whitespace-pre-wrap">
                {data.a.run.final_output ?? "(no output)"}
              </pre>
              <pre className="max-h-64 overflow-auto rounded-lg bg-black/30 p-3 text-xs text-zinc-300 whitespace-pre-wrap">
                {data.b.run.final_output ?? "(no output)"}
              </pre>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function RunCard({ title, detail }: { title: string; detail: RunDetailData }) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 font-mono text-xs text-zinc-500">{detail.run.run_id}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <span className="text-zinc-500">Status</span>
        <span>{detail.run.status}</span>
        <span className="text-zinc-500">Latency</span>
        <span>
          {detail.run.total_latency != null
            ? `${Math.round(detail.run.total_latency)}ms`
            : "—"}
        </span>
        <span className="text-zinc-500">Tokens</span>
        <span>{detail.run.total_tokens ?? "—"}</span>
        <span className="text-zinc-500">Steps</span>
        <span>{detail.steps.length}</span>
        <span className="text-zinc-500">Errors</span>
        <span>{detail.steps.filter((s) => s.error_message).length}</span>
      </div>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-zinc-500">Loading...</div>}>
      <CompareContent />
    </Suspense>
  );
}

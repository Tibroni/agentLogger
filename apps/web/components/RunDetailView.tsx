"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Wrench, AlertCircle } from "lucide-react";

export interface RunDetailData {
  run: {
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
    metadata?: Record<string, unknown>;
  };
  steps: Array<{
    step_id: string;
    run_id: string;
    step_type: string;
    step_name: string;
    input_payload?: unknown;
    output_payload?: unknown;
    timestamp: string;
    duration_ms?: number;
    error_message?: string;
  }>;
  toolCalls: Array<{
    tool_call_id: string;
    run_id: string;
    step_id?: string;
    tool_name: string;
    input: unknown;
    output?: unknown;
    success: boolean;
    duration_ms?: number;
    timestamp: string;
  }>;
  evaluations: Array<{
    evaluation_id: string;
    run_id: string;
    eval_type: string;
    score?: number;
    rubric_name?: string;
    reviewer?: string;
    comments?: string;
    created_at: string;
  }>;
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

function PayloadBlock({ label, data }: { label: string; data: unknown }) {
  if (data == null) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-zinc-500">{label}</p>
      <pre className="overflow-x-auto rounded-lg bg-black/30 p-3 font-mono text-xs text-zinc-300">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

export function RunDetailView({ detail }: { detail: RunDetailData }) {
  const { run, steps, toolCalls } = detail;
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  const toggleStep = (stepId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  };

  const toolsForStep = (stepId: string) =>
    toolCalls.filter((tc) => tc.step_id === stepId);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div className="rounded-xl border border-surface-border bg-surface-raised p-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="font-mono text-sm text-zinc-400">{run.run_id}</h1>
              <p className="mt-2 text-lg font-semibold">{run.project_id}</p>
            </div>
            <StatusBadge status={run.status} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <div>
              <p className="text-zinc-500">Environment</p>
              <p>{run.environment}</p>
            </div>
            <div>
              <p className="text-zinc-500">Latency</p>
              <p>{run.total_latency != null ? `${Math.round(run.total_latency)}ms` : "—"}</p>
            </div>
            <div>
              <p className="text-zinc-500">Tokens</p>
              <p>{run.total_tokens ?? "—"}</p>
            </div>
            <div>
              <p className="text-zinc-500">Cost</p>
              <p>{run.total_cost != null ? `$${run.total_cost.toFixed(4)}` : "—"}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-surface-border bg-surface-raised p-6">
          <h2 className="mb-3 font-semibold">User Input</h2>
          <p className="text-zinc-300">{run.user_input}</p>
        </div>

        {run.final_output && (
          <div className="rounded-xl border border-surface-border bg-surface-raised p-6">
            <h2 className="mb-3 font-semibold">Final Output</h2>
            <p className="text-zinc-300">{run.final_output}</p>
          </div>
        )}

        <div className="space-y-3">
          <h2 className="font-semibold">Timeline</h2>
          {steps.length === 0 ? (
            <p className="text-sm text-zinc-500">No steps recorded.</p>
          ) : (
            steps.map((step) => {
              const expanded = expandedSteps.has(step.step_id);
              const stepTools = toolsForStep(step.step_id);
              return (
                <div
                  key={step.step_id}
                  className="rounded-xl border border-surface-border bg-surface-raised"
                >
                  <button
                    onClick={() => toggleStep(step.step_id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  >
                    {expanded ? (
                      <ChevronDown className="h-4 w-4 text-zinc-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-zinc-500" />
                    )}
                    <div className="flex-1">
                      <span className="font-medium">{step.step_name}</span>
                      <span className="ml-2 text-xs text-zinc-500">{step.step_type}</span>
                    </div>
                    {step.duration_ms != null && (
                      <span className="text-xs text-zinc-500">{step.duration_ms}ms</span>
                    )}
                    {step.error_message && (
                      <AlertCircle className="h-4 w-4 text-red-400" />
                    )}
                  </button>
                  {expanded && (
                    <div className="space-y-3 border-t border-surface-border px-4 py-3">
                      <PayloadBlock label="Input" data={step.input_payload} />
                      <PayloadBlock label="Output" data={step.output_payload} />
                      {step.error_message && (
                        <p className="text-sm text-red-400">{step.error_message}</p>
                      )}
                      {stepTools.map((tool) => (
                        <div
                          key={tool.tool_call_id}
                          className="rounded-lg border border-surface-border bg-black/20 p-3"
                        >
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Wrench className="h-4 w-4 text-accent" />
                            {tool.tool_name}
                            <span
                              className={
                                tool.success ? "text-emerald-400" : "text-red-400"
                              }
                            >
                              {tool.success ? "success" : "failed"}
                            </span>
                          </div>
                          <div className="mt-2 space-y-2">
                            <PayloadBlock label="Tool Input" data={tool.input} />
                            <PayloadBlock label="Tool Output" data={tool.output} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="space-y-4">
        {run.metadata && Object.keys(run.metadata).length > 0 && (
          <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
            <h3 className="mb-2 text-sm font-semibold">Metadata</h3>
            <pre className="font-mono text-xs text-zinc-400">
              {JSON.stringify(run.metadata, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

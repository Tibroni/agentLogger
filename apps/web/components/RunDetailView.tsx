"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Wrench,
  AlertCircle,
  Bot,
  Zap,
  ArrowDown,
} from "lucide-react";

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
    parent_run_id?: string;
    root_run_id?: string;
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
    parent_step_id?: string;
    attempt?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    model?: string;
    provider?: string;
    estimated_cost?: number;
    context_limit?: number;
    input_token_estimate?: number;
    time_to_first_token_ms?: number;
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

function previewText(data: unknown, max = 240): string {
  if (data == null) return "";
  const text =
    typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function extractLlmPreview(step: RunDetailData["steps"][number]): {
  prompt?: string;
  response?: string;
} {
  const input = step.input_payload as Record<string, unknown> | undefined;
  const output = step.output_payload as Record<string, unknown> | undefined;

  let prompt: string | undefined;
  const body = input?.body as Record<string, unknown> | undefined;
  if (body?.messages && Array.isArray(body.messages)) {
    prompt = body.messages
      .map((m: { role?: string; content?: string }) => `${m.role}: ${m.content}`)
      .join("\n");
  } else if (input?.prompt) {
    prompt = String(input.prompt);
  }

  let response: string | undefined;
  if (output?.stream && typeof output.stream === "string") {
    response = output.stream;
  } else if (output?.choices) {
    const choices = output.choices as Array<{ message?: { content?: string } }>;
    response = choices[0]?.message?.content;
  } else if (output) {
    response = previewText(output, 400);
  }

  return { prompt, response };
}

function PayloadBlock({ label, data }: { label: string; data: unknown }) {
  if (data == null) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-zinc-500">{label}</p>
      <pre className="max-h-64 overflow-auto rounded-lg bg-black/30 p-3 font-mono text-xs text-zinc-300">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

export function RunDetailView({
  detail,
  live = false,
}: {
  detail: RunDetailData;
  live?: boolean;
}) {
  const { run, steps, toolCalls } = detail;
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [currentDetail, setCurrentDetail] = useState(detail);
  const firstErrorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setCurrentDetail(detail);
  }, [detail]);

  useEffect(() => {
    if (!live && run.status !== "running") return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/v1/runs/${run.run_id}`);
      if (res.ok) {
        const json = (await res.json()) as RunDetailData;
        setCurrentDetail(json);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [live, run.run_id, run.status]);

  const active = currentDetail;
  const runStart = new Date(active.run.start_time).getTime();
  const totalDuration =
    active.steps.reduce((max, s) => {
      const end =
        new Date(s.timestamp).getTime() + (s.duration_ms ?? 0) - runStart;
      return Math.max(max, end);
    }, 0) || active.run.total_latency || 1;

  const firstErrorStep = active.steps.find((s) => s.error_message);
  const orphanTools = active.toolCalls.filter(
    (tc) => !tc.step_id || !active.steps.some((s) => s.step_id === tc.step_id)
  );

  const groupedSteps = useMemo(() => {
    const roots = active.steps.filter((s) => !s.parent_step_id);
    const retries = active.steps.filter((s) => s.parent_step_id);
    return { roots, retries };
  }, [active.steps]);

  const toggleStep = (stepId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  };

  const toolsForStep = (stepId: string) =>
    active.toolCalls.filter((tc) => tc.step_id === stepId);

  const scrollToFirstError = () => {
    firstErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (firstErrorStep) {
      setExpandedSteps((prev) => new Set(prev).add(firstErrorStep.step_id));
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div className="rounded-xl border border-surface-border bg-surface-raised p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-mono text-sm text-zinc-400">{active.run.run_id}</h1>
              <p className="mt-2 text-lg font-semibold">{active.run.project_id}</p>
              {active.run.parent_run_id && (
                <p className="mt-1 text-xs text-zinc-500">
                  Child of {active.run.parent_run_id.slice(0, 8)}…
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {active.run.status === "running" && (
                <span className="text-xs text-amber-400">Live · polling</span>
              )}
              <StatusBadge status={active.run.status} />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <div>
              <p className="text-zinc-500">Environment</p>
              <p>{active.run.environment}</p>
            </div>
            <div>
              <p className="text-zinc-500">Latency</p>
              <p>
                {active.run.total_latency != null
                  ? `${Math.round(active.run.total_latency)}ms`
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-zinc-500">Tokens</p>
              <p>{active.run.total_tokens ?? "—"}</p>
            </div>
            <div>
              <p className="text-zinc-500">Cost</p>
              <p>
                {active.run.total_cost != null
                  ? `$${active.run.total_cost.toFixed(4)}`
                  : "—"}
              </p>
            </div>
          </div>
          {firstErrorStep && (
            <button
              onClick={scrollToFirstError}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/20"
            >
              <ArrowDown className="h-4 w-4" />
              Jump to first failure
            </button>
          )}
        </div>

        <div className="rounded-xl border border-surface-border bg-surface-raised p-6">
          <h2 className="mb-3 font-semibold">User Input</h2>
          <p className="whitespace-pre-wrap text-zinc-300">{active.run.user_input}</p>
        </div>

        {active.run.final_output && (
          <div className="rounded-xl border border-surface-border bg-surface-raised p-6">
            <h2 className="mb-3 font-semibold">Final Output</h2>
            <p className="whitespace-pre-wrap text-zinc-300">{active.run.final_output}</p>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Agent Timeline</h2>
            <span className="text-xs text-zinc-500">
              {active.steps.length} steps · {active.toolCalls.length} tools
            </span>
          </div>

          {active.steps.length > 0 && (
            <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
              <div className="flex h-8 items-end gap-0.5">
                {groupedSteps.roots.map((step) => {
                  const offset =
                    new Date(step.timestamp).getTime() - runStart;
                  const width = Math.max(
                    4,
                    ((step.duration_ms ?? 50) / totalDuration) * 100
                  );
                  const isLlm = step.step_type === "llm";
                  const isError = Boolean(step.error_message);
                  return (
                    <div
                      key={step.step_id}
                      title={`${step.step_name} · ${step.duration_ms ?? 0}ms`}
                      className={`rounded-sm ${isError ? "bg-red-500/70" : isLlm ? "bg-accent/70" : "bg-zinc-500/50"}`}
                      style={{
                        width: `${width}%`,
                        marginLeft: `${(offset / totalDuration) * 2}%`,
                        height: isLlm ? "100%" : "60%",
                      }}
                    />
                  );
                })}
              </div>
              <div className="mt-2 flex justify-between text-xs text-zinc-500">
                <span>0ms</span>
                <span>{Math.round(totalDuration)}ms</span>
              </div>
            </div>
          )}

          {active.steps.length === 0 ? (
            <p className="text-sm text-zinc-500">No steps recorded.</p>
          ) : (
            active.steps.map((step) => {
              const expanded = expandedSteps.has(step.step_id);
              const stepTools = toolsForStep(step.step_id);
              const isLlm = step.step_type === "llm";
              const llmPreview = isLlm ? extractLlmPreview(step) : null;
              const nearLimit =
                step.input_token_estimate != null &&
                step.context_limit != null &&
                step.input_token_estimate / step.context_limit >= 0.85;

              return (
                <div
                  key={step.step_id}
                  ref={step.error_message ? firstErrorRef : undefined}
                  className={`rounded-xl border bg-surface-raised ${
                    step.error_message
                      ? "border-red-500/40"
                      : "border-surface-border"
                  }`}
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
                    {isLlm ? (
                      <Bot className="h-4 w-4 text-accent" />
                    ) : (
                      <Zap className="h-4 w-4 text-zinc-400" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{step.step_name}</span>
                        <span className="text-xs text-zinc-500">{step.step_type}</span>
                        {step.attempt != null && step.attempt > 1 && (
                          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-xs text-amber-300">
                            attempt {step.attempt}
                          </span>
                        )}
                        {nearLimit && (
                          <span className="rounded bg-orange-500/20 px-1.5 py-0.5 text-xs text-orange-300">
                            near context limit
                          </span>
                        )}
                      </div>
                      {isLlm && !expanded && llmPreview?.response && (
                        <p className="mt-1 truncate text-xs text-zinc-400">
                          {llmPreview.response}
                        </p>
                      )}
                      {isLlm && (step.model || step.total_tokens != null) && (
                        <p className="mt-1 text-xs text-zinc-500">
                          {step.model && <span>{step.model}</span>}
                          {step.total_tokens != null && (
                            <span> · {step.total_tokens} tokens</span>
                          )}
                          {step.estimated_cost != null && (
                            <span> · ${step.estimated_cost.toFixed(4)}</span>
                          )}
                          {step.time_to_first_token_ms != null && (
                            <span> · TTFT {step.time_to_first_token_ms}ms</span>
                          )}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-zinc-500">
                      +{Math.round(new Date(step.timestamp).getTime() - runStart)}ms
                    </span>
                    {step.duration_ms != null && (
                      <span className="shrink-0 text-xs text-zinc-500">
                        {step.duration_ms}ms
                      </span>
                    )}
                    {step.error_message && (
                      <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                    )}
                  </button>
                  {expanded && (
                    <div className="space-y-3 border-t border-surface-border px-4 py-3">
                      {isLlm && llmPreview?.prompt && (
                        <div>
                          <p className="mb-1 text-xs font-medium text-zinc-500">Prompt</p>
                          <pre className="max-h-40 overflow-auto rounded-lg bg-black/30 p-3 text-xs text-zinc-300 whitespace-pre-wrap">
                            {llmPreview.prompt}
                          </pre>
                        </div>
                      )}
                      {isLlm && llmPreview?.response && (
                        <div>
                          <p className="mb-1 text-xs font-medium text-zinc-500">Response</p>
                          <pre className="max-h-40 overflow-auto rounded-lg bg-black/30 p-3 text-xs text-zinc-300 whitespace-pre-wrap">
                            {llmPreview.response}
                          </pre>
                        </div>
                      )}
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

          {orphanTools.length > 0 && (
            <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
              <h3 className="mb-3 text-sm font-semibold text-zinc-300">
                Tool calls (unlinked)
              </h3>
              <div className="space-y-3">
                {orphanTools.map((tool) => (
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
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {active.evaluations.length > 0 && (
          <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
            <h3 className="mb-2 text-sm font-semibold">Evaluations</h3>
            <div className="space-y-2">
              {active.evaluations.map((ev) => (
                <div key={ev.evaluation_id} className="text-xs text-zinc-400">
                  <span className="text-zinc-200">{ev.eval_type}</span>
                  {ev.score != null && (
                    <span> · score {(ev.score * 100).toFixed(0)}%</span>
                  )}
                  {ev.comments && <p className="mt-1">{ev.comments}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
        {active.run.metadata && Object.keys(active.run.metadata).length > 0 && (
          <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
            <h3 className="mb-2 text-sm font-semibold">Metadata</h3>
            <pre className="max-h-64 overflow-auto font-mono text-xs text-zinc-400">
              {JSON.stringify(active.run.metadata, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

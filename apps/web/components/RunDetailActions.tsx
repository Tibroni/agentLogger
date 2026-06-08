"use client";

import { useState } from "react";
import { Download, Sparkles } from "lucide-react";

export function RunDetailActions({
  runId,
  projectId,
}: {
  runId: string;
  projectId?: string;
}) {
  const [evaluating, setEvaluating] = useState(false);
  const [evalScore, setEvalScore] = useState<number | null>(null);
  const query = projectId ? `&project_id=${encodeURIComponent(projectId)}` : "";

  const runAutoEval = async () => {
    setEvaluating(true);
    try {
      const res = await fetch(`/api/v1/runs/${runId}/evaluate-auto`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_OBSERVABILITY_API_KEY ?? "dev-api-key-change-me"}`,
        },
      });
      if (res.ok) {
        const body = (await res.json()) as { evaluation?: { score?: number } };
        if (body.evaluation?.score != null) {
          setEvalScore(body.evaluation.score);
        }
        window.location.reload();
      }
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={`/api/v1/runs/${runId}/export?format=json${query}`}
        className="inline-flex items-center gap-2 rounded-lg border border-surface-border px-3 py-1.5 text-sm hover:bg-surface-raised"
      >
        <Download className="h-4 w-4" />
        JSON
      </a>
      <a
        href={`/api/v1/runs/${runId}/export?format=jsonl${query}`}
        className="inline-flex items-center gap-2 rounded-lg border border-surface-border px-3 py-1.5 text-sm hover:bg-surface-raised"
      >
        <Download className="h-4 w-4" />
        JSONL
      </a>
      <a
        href={`/api/v1/runs/${runId}/export?format=otel${query}`}
        className="inline-flex items-center gap-2 rounded-lg border border-surface-border px-3 py-1.5 text-sm hover:bg-surface-raised"
      >
        <Download className="h-4 w-4" />
        OTel
      </a>
      <button
        onClick={() => void runAutoEval()}
        disabled={evaluating}
        className="inline-flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-sm text-accent-muted hover:bg-accent/20 disabled:opacity-50"
      >
        <Sparkles className="h-4 w-4" />
        {evaluating ? "Evaluating..." : "Auto-evaluate"}
        {evalScore != null && ` (${(evalScore * 100).toFixed(0)}%)`}
      </button>
    </div>
  );
}

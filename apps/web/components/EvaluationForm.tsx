"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Evaluation {
  evaluation_id: string;
  eval_type: string;
  score?: number;
  rubric_name?: string;
  reviewer?: string;
  comments?: string;
  created_at: string;
}

export function EvaluationForm({
  runId,
  evaluations,
}: {
  runId: string;
  evaluations: Evaluation[];
}) {
  const router = useRouter();
  const [comments, setComments] = useState("");
  const [score, setScore] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/runs/${runId}/evaluations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_OBSERVABILITY_API_KEY ?? "dev-api-key-change-me"}`,
        },
        body: JSON.stringify({
          eval_type: "manual",
          comments: comments || undefined,
          score: score ? parseFloat(score) : undefined,
          reviewer: reviewer || undefined,
          rubric_name: "manual_review",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit evaluation");
      }

      setComments("");
      setScore("");
      setReviewer("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-surface-border bg-surface-raised p-6">
      <h2 className="mb-4 font-semibold">Evaluations</h2>

      {evaluations.length > 0 && (
        <div className="mb-6 space-y-3">
          {evaluations.map((ev) => (
            <div
              key={ev.evaluation_id}
              className="rounded-lg border border-surface-border bg-black/20 p-3 text-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">{ev.eval_type}</span>
                {ev.score != null && (
                  <span className="font-medium">Score: {ev.score}</span>
                )}
              </div>
              {ev.comments && <p className="mt-1 text-zinc-300">{ev.comments}</p>}
              {ev.reviewer && (
                <p className="mt-1 text-xs text-zinc-500">by {ev.reviewer}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Comments</label>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-surface-border bg-black/20 px-3 py-2 text-sm outline-none focus:border-accent"
            placeholder="Mark this run as good or bad..."
          />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-zinc-500">Score (0-1)</label>
            <input
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              className="w-full rounded-lg border border-surface-border bg-black/20 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-zinc-500">Reviewer</label>
            <input
              type="text"
              value={reviewer}
              onChange={(e) => setReviewer(e.target.value)}
              className="w-full rounded-lg border border-surface-border bg-black/20 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-muted disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Add evaluation"}
        </button>
      </form>
    </div>
  );
}

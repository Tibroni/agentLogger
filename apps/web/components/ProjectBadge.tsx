"use client";

import { useSearchParams } from "next/navigation";
import { resolveActiveProjectId } from "@/lib/project-client";

export function ProjectBadge() {
  const searchParams = useSearchParams();
  const projectId = resolveActiveProjectId(searchParams.get("project_id"));

  if (!projectId) {
    return (
      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400">
        No project filter
      </span>
    );
  }

  return (
    <span
      className="max-w-[12rem] truncate rounded-full bg-accent/20 px-2 py-0.5 text-xs text-accent-muted"
      title={projectId}
    >
      {projectId}
    </span>
  );
}

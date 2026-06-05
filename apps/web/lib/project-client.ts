"use client";

const STORAGE_KEY = "agentlogger:project_id";

/** Resolved project filter: URL param → localStorage → build-time env default. */
export function resolveActiveProjectId(searchParam: string | null): string {
  if (searchParam?.trim()) return searchParam.trim();

  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored?.trim()) return stored.trim();
  }

  return process.env.NEXT_PUBLIC_OBSERVABILITY_PROJECT_ID?.trim() ?? "";
}

export function persistProjectId(projectId: string): void {
  if (typeof window === "undefined" || !projectId.trim()) return;
  localStorage.setItem(STORAGE_KEY, projectId.trim());
}

export function runsListHref(projectId: string): string {
  if (!projectId) return "/runs";
  return `/runs?project_id=${encodeURIComponent(projectId)}`;
}

export function runDetailHref(runId: string, projectId: string): string {
  if (!projectId) return `/runs/${runId}`;
  return `/runs/${runId}?project_id=${encodeURIComponent(projectId)}`;
}

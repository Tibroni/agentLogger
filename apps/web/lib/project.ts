/** Dashboard project scope — must match SDK init({ projectId }) in your agent app. */
export function getDashboardProjectId(): string | undefined {
  // OBSERVABILITY_PROJECT_ID is runtime-only (npm dashboard sets this on launch).
  // NEXT_PUBLIC_* is baked at build time and must not be the only source in production.
  const id =
    process.env.OBSERVABILITY_PROJECT_ID?.trim() ||
    process.env.NEXT_PUBLIC_OBSERVABILITY_PROJECT_ID?.trim();
  return id || undefined;
}

export function assertRunBelongsToProject(
  runProjectId: string,
  activeProjectId: string | undefined
): boolean {
  if (!activeProjectId) return true;
  return runProjectId === activeProjectId;
}

export function runsListHref(projectId: string): string {
  if (!projectId) return "/runs";
  return `/runs?project_id=${encodeURIComponent(projectId)}`;
}

export function runDetailHref(runId: string, projectId: string): string {
  if (!projectId) return `/runs/${runId}`;
  return `/runs/${runId}?project_id=${encodeURIComponent(projectId)}`;
}

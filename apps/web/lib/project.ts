/** Dashboard project scope — must match SDK init({ projectId }) in your agent app. */
export function getDashboardProjectId(): string | undefined {
  const id = process.env.NEXT_PUBLIC_OBSERVABILITY_PROJECT_ID?.trim();
  return id || undefined;
}

export function assertRunBelongsToProject(
  runProjectId: string,
  activeProjectId: string | undefined
): boolean {
  if (!activeProjectId) return true;
  return runProjectId === activeProjectId;
}

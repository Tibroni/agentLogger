"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Activity } from "lucide-react";
import { ProjectBadge } from "@/components/ProjectBadge";
import { runsListHref, resolveActiveProjectId } from "@/lib/project-client";

function HeaderContent() {
  const searchParams = useSearchParams();
  const projectId = resolveActiveProjectId(searchParams.get("project_id"));
  const runsHref = runsListHref(projectId);

  return (
    <>
      <Link href={runsHref} className="text-lg font-semibold tracking-tight">
        Agent Logger
      </Link>
      <nav className="ml-auto flex items-center gap-4 text-sm text-zinc-400">
        <ProjectBadge />
        <Link href={runsHref} className="hover:text-zinc-100">
          Runs
        </Link>
      </nav>
    </>
  );
}

export function SiteHeader() {
  return (
    <header className="border-b border-surface-border bg-surface-raised">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-6 py-4">
        <Activity className="h-5 w-5 text-accent" />
        <Suspense
          fallback={
            <>
              <span className="text-lg font-semibold tracking-tight">
                Agent Logger
              </span>
              <div className="ml-auto h-5 w-24" />
            </>
          }
        >
          <HeaderContent />
        </Suspense>
      </div>
    </header>
  );
}

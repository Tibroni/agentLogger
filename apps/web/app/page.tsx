import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">
        AI Agent Observability
      </h1>
      <p className="max-w-2xl text-zinc-400">
        Trace, debug, and evaluate your AI agents. Install the SDK, run your
        agent, and inspect every step in the dashboard.
      </p>
      <Link
        href="/runs"
        className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-muted"
      >
        View runs
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

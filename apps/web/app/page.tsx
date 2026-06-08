import { redirect } from "next/navigation";
import { getDashboardProjectId, runsListHref } from "@/lib/project";

export default function HomePage() {
  redirect(runsListHref(getDashboardProjectId() ?? ""));
}

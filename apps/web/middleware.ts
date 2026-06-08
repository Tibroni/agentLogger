import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getDashboardProjectId } from "@/lib/project";

export function middleware(request: NextRequest) {
  const projectId = getDashboardProjectId();
  const { pathname, searchParams } = request.nextUrl;

  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/runs";
    if (projectId) url.searchParams.set("project_id", projectId);
    return NextResponse.redirect(url);
  }

  if (!projectId) return NextResponse.next();
  if (!pathname.startsWith("/runs")) return NextResponse.next();
  if (searchParams.has("project_id")) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.searchParams.set("project_id", projectId);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/", "/runs", "/runs/:path*"],
};

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const projectId = process.env.NEXT_PUBLIC_OBSERVABILITY_PROJECT_ID?.trim();

export function middleware(request: NextRequest) {
  if (!projectId) return NextResponse.next();

  const { pathname, searchParams } = request.nextUrl;
  if (!pathname.startsWith("/runs")) return NextResponse.next();
  if (searchParams.has("project_id")) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.searchParams.set("project_id", projectId);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/runs", "/runs/:path*"],
};

import { NextRequest } from "next/server";

export function getApiKey(): string {
  return process.env.OBSERVABILITY_API_KEY ?? "dev-api-key-change-me";
}

export function validateApiKey(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return false;
  }
  const token = authHeader.slice(7);
  return token === getApiKey();
}

export function unauthorizedResponse() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export function badRequestResponse(message: string, details?: unknown) {
  return Response.json({ error: message, details }, { status: 400 });
}

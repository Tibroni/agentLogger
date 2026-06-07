const SECRET_KEYS = new Set([
  "authorization",
  "api_key",
  "apikey",
  "api-key",
  "x-api-key",
  "access_token",
  "secret",
  "password",
  "token",
]);

const DEFAULT_MAX_BYTES = 64 * 1024;

export function truncateValue(value: unknown, maxBytes = DEFAULT_MAX_BYTES): unknown {
  if (value == null) return value;
  const json = JSON.stringify(value);
  if (json.length <= maxBytes) return value;
  return {
    _agentlogger_truncated: true,
    preview: json.slice(0, maxBytes),
    original_bytes: json.length,
  };
}

export function sanitizeHeaders(
  headers: Headers | Record<string, string> | undefined
): Record<string, string> | undefined {
  if (!headers) return undefined;

  const result: Record<string, string> = {};
  const entries =
    headers instanceof Headers
      ? Array.from(headers.entries())
      : Object.entries(headers);

  for (const [key, value] of entries) {
    if (SECRET_KEYS.has(key.toLowerCase())) {
      result[key] = "[REDACTED]";
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function sanitizeBody(body: unknown): unknown {
  if (body == null || typeof body !== "object") return body;
  if (Array.isArray(body)) return body.map(sanitizeBody);

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (SECRET_KEYS.has(key.toLowerCase())) {
      result[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      result[key] = sanitizeBody(value);
    } else {
      result[key] = value;
    }
  }
  return truncateValue(result);
}

export async function readRequestBody(
  init?: RequestInit
): Promise<{ body: unknown; raw: string | null }> {
  if (!init?.body) return { body: null, raw: null };

  if (typeof init.body === "string") {
    try {
      return { body: sanitizeBody(JSON.parse(init.body)), raw: init.body };
    } catch {
      return { body: init.body.slice(0, 4096), raw: init.body };
    }
  }

  return { body: "[non-string body]", raw: null };
}

export async function readResponseBody(
  response: Response
): Promise<{ body: unknown; text: string | null }> {
  const contentType = response.headers?.get?.("content-type") ?? "";
  if (contentType.includes("text/event-stream")) {
    return { body: "[streaming response]", text: null };
  }

  try {
    const text = await response.text();
    try {
      return { body: sanitizeBody(JSON.parse(text)), text };
    } catch {
      return { body: text.slice(0, 4096), text };
    }
  } catch {
    return { body: null, text: null };
  }
}

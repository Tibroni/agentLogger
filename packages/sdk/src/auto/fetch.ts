import { detectLlmRequest, extractUsage } from "./detect.js";
import { ensureAutoRun } from "./lifecycle.js";
import { runInContextAsync } from "./context.js";
import {
  readRequestBody,
  readResponseBody,
  sanitizeHeaders,
} from "./sanitize.js";

const AGENTLOGGER_FETCH = Symbol.for("agentlogger.originalFetch");

type FetchFn = typeof fetch;

function getOriginalFetch(): FetchFn {
  const g = globalThis as typeof globalThis & {
    [AGENTLOGGER_FETCH]?: FetchFn;
  };
  if (!g[AGENTLOGGER_FETCH]) {
    g[AGENTLOGGER_FETCH] = globalThis.fetch.bind(globalThis);
  }
  return g[AGENTLOGGER_FETCH];
}

async function handleStreamingResponse(
  response: Response,
  step: ReturnType<ReturnType<typeof ensureAutoRun>["run"]["startStep"]>,
  run: ReturnType<typeof ensureAutoRun>["run"],
  host: string
): Promise<Response> {
  if (!response.body) return response;

  const [clientStream, logStream] = response.body.tee();
  const reader = logStream.getReader();
  const decoder = new TextDecoder();
  let accumulated = "";

  void (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        if (accumulated.length > 256 * 1024) {
          accumulated = accumulated.slice(-256 * 1024);
        }
      }
      step.end({ output: { stream: accumulated.slice(0, 8192) } });
      run.recordUsage({ provider: host });
    } catch (error) {
      step.fail({ error: error instanceof Error ? error : String(error) });
    }
  })();

  return new Response(clientStream, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

export function patchFetch(): void {
  if ((globalThis.fetch as FetchFn & { __agentlogger?: boolean }).__agentlogger) {
    return;
  }

  const originalFetch = getOriginalFetch();

  const patchedFetch: FetchFn & { __agentlogger?: boolean } = async (
    input: RequestInfo | URL,
    init?: RequestInit
  ) => {
    const url =
      input instanceof Request
        ? input.url
        : typeof input === "string"
          ? input
          : input.toString();

    const mergedInit: RequestInit =
      input instanceof Request
        ? {
            method: init?.method ?? input.method,
            headers: init?.headers ?? input.headers,
            body: init?.body ?? (input.method !== "GET" ? input.body : undefined),
          }
        : (init ?? {});

    const { body: parsedBody } = await readRequestBody(mergedInit);
    const detection = detectLlmRequest(url, mergedInit, parsedBody ?? undefined);

    if (!detection.isLlm) {
      return originalFetch(input, init);
    }

    const ctx = ensureAutoRun();
    const step = ctx.run.startStep({
      type: "llm",
      name: detection.model ?? detection.host,
      input: {
        url,
        method: mergedInit.method ?? "GET",
        headers: sanitizeHeaders(mergedInit.headers),
        body: parsedBody,
      },
    });

    const startMs = Date.now();

    try {
      const response = await runInContextAsync(ctx, () =>
        originalFetch(input, init)
      );

      const contentType =
        response.headers?.get?.("content-type")?.toLowerCase() ?? "";

      if (detection.streaming || contentType.includes("text/event-stream")) {
        return handleStreamingResponse(response, step, ctx.run, detection.host);
      }

      const responseForRead =
        typeof response.clone === "function" ? response.clone() : response;
      const { body: responseBody } = await readResponseBody(responseForRead);
      const durationMs = Date.now() - startMs;

      if (!response.ok) {
        step.fail({
          error: `HTTP ${response.status}: ${JSON.stringify(responseBody).slice(0, 500)}`,
        });
      } else {
        step.end({ output: responseBody });
        const usage = extractUsage(responseBody);
        ctx.run.recordUsage({
          ...usage,
          model: detection.model,
          provider: detection.host,
        });
      }

      void durationMs;
      return response;
    } catch (error) {
      step.fail({ error: error instanceof Error ? error : String(error) });
      throw error;
    }
  };

  patchedFetch.__agentlogger = true;
  globalThis.fetch = patchedFetch;
}

export function unpatchFetchForTests(): void {
  const g = globalThis as typeof globalThis & {
    [AGENTLOGGER_FETCH]?: FetchFn;
  };
  if (g[AGENTLOGGER_FETCH]) {
    globalThis.fetch = g[AGENTLOGGER_FETCH];
    delete g[AGENTLOGGER_FETCH];
  }
  delete (globalThis.fetch as FetchFn & { __agentlogger?: boolean }).__agentlogger;
}

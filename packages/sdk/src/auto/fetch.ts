import {
  detectLlmRequest,
  extractAssistantText,
  extractUsage,
} from "./detect.js";
import { ensureAutoRun, scheduleAutoRunEnd } from "./lifecycle.js";
import { runInContextAsync } from "./context.js";
import {
  readRequestBody,
  readResponseBody,
  sanitizeHeaders,
} from "./sanitize.js";
import { resolveRetryAttempt, registerRetryStep } from "./retry.js";
import { parseSseStream } from "./streaming.js";
import { estimateCost } from "../pricing.js";
import {
  getContextLimit,
  estimateInputTokens,
  isNearContextLimit,
} from "../context-window.js";

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
  host: string,
  model?: string,
  inputEstimate?: number,
  contextLimit?: number
): Promise<Response> {
  if (!response.body) return response;

  const [clientStream, logStream] = response.body.tee();
  const reader = logStream.getReader();
  const decoder = new TextDecoder();
  let accumulated = "";
  let firstTokenMs: number | undefined;
  const streamStart = Date.now();

  void (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (firstTokenMs == null && value?.length) {
          firstTokenMs = Date.now() - streamStart;
        }
        accumulated += decoder.decode(value, { stream: true });
        if (accumulated.length > 256 * 1024) {
          accumulated = accumulated.slice(-256 * 1024);
        }
      }

      const parsed = parseSseStream(accumulated);
      const usage = parsed.usage ?? {};
      const estimatedCost = estimateCost({
        model,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
      });

      step.end({
        output: { stream: parsed.text || accumulated.slice(0, 8192) },
        usage: {
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens: usage.totalTokens,
          model,
          provider: host,
          estimatedCost,
          contextLimit,
          inputTokenEstimate: inputEstimate,
          timeToFirstTokenMs: firstTokenMs,
        },
      });

      run.recordUsage({
        ...usage,
        model,
        provider: host,
      });

      if (parsed.text) scheduleAutoRunEnd(parsed.text);
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
    const retry = resolveRetryAttempt(url, detection.model, parsedBody);
    const inputEstimate = estimateInputTokens(parsedBody);
    const contextLimit = getContextLimit(detection.model);

    const step = ctx.run.startStep({
      type: "llm",
      name: detection.model ?? detection.host,
      input: {
        url,
        method: mergedInit.method ?? "GET",
        headers: sanitizeHeaders(mergedInit.headers),
        body: parsedBody,
        input_token_estimate: inputEstimate,
        context_limit: contextLimit,
        near_context_limit: isNearContextLimit({
          inputTokenEstimate: inputEstimate,
          contextLimit,
        }),
      },
      parentStepId: retry.parentStepId,
      attempt: retry.attempt,
    });
    registerRetryStep(step.stepId, url, detection.model, parsedBody);

    const startMs = Date.now();

    try {
      const response = await runInContextAsync(ctx, () =>
        originalFetch(input, init)
      );

      const contentType =
        response.headers?.get?.("content-type")?.toLowerCase() ?? "";

      if (detection.streaming || contentType.includes("text/event-stream")) {
        return handleStreamingResponse(
          response,
          step,
          ctx.run,
          detection.host,
          detection.model,
          inputEstimate,
          contextLimit
        );
      }

      const responseForRead =
        typeof response.clone === "function" ? response.clone() : response;
      const { body: responseBody } = await readResponseBody(responseForRead);

      if (!response.ok) {
        step.fail({
          error: `HTTP ${response.status}: ${JSON.stringify(responseBody).slice(0, 500)}`,
        });
      } else {
        const usage = extractUsage(responseBody);
        const estimatedCost = estimateCost({
          model: detection.model,
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
        });

        step.end({
          output: responseBody,
          usage: {
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            totalTokens: usage.totalTokens,
            model: detection.model,
            provider: detection.host,
            estimatedCost,
            contextLimit,
            inputTokenEstimate: inputEstimate,
            timeToFirstTokenMs: Date.now() - startMs,
          },
        });

        ctx.run.recordUsage({
          ...usage,
          model: detection.model,
          provider: detection.host,
        });
        scheduleAutoRunEnd(extractAssistantText(responseBody));
      }

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

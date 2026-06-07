import type { IncomingMessage, ServerResponse } from "http";
import { ensureAutoRun, endAutoRun } from "../auto/lifecycle.js";
import { runInContextAsync } from "../auto/context.js";
import { autoInit } from "../auto/init.js";

export interface HttpMiddlewareOptions {
  /** JSON path to extract user input from request body, e.g. "message" or "body.prompt" */
  userInputFrom?: string;
  /** Header name for user input fallback */
  userInputHeader?: string;
}

function getByPath(obj: unknown, dotPath: string): unknown {
  let current: unknown = obj;
  for (const key of dotPath.split(".")) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function resolveUserInput(
  body: unknown,
  req: IncomingMessage,
  options: HttpMiddlewareOptions
): string {
  if (options.userInputFrom && body != null) {
    const value = getByPath(body, options.userInputFrom);
    if (value != null) return String(value);
  }
  if (options.userInputHeader) {
    const header = req.headers[options.userInputHeader.toLowerCase()];
    if (header) return Array.isArray(header) ? header[0] : header;
  }
  return `HTTP ${req.method ?? "REQUEST"} ${req.url ?? "/"}`;
}

/**
 * Node.js HTTP middleware — one traced run per request.
 * Compatible with Express (req, res, next), Fastify (req, reply, next), and raw Node http.
 */
export function agentLoggerMiddleware(options: HttpMiddlewareOptions = {}) {
  autoInit();

  return async (
    req: IncomingMessage & { body?: unknown },
    res: ServerResponse,
    next?: (error?: unknown) => void
  ): Promise<void> => {
    const body = req.body ?? (await readJsonBody(req));
    const userInput = resolveUserInput(body, req, options);
    const ctx = ensureAutoRun(userInput);

    const finish = async (status: "success" | "error", output?: string) => {
      if (ctx.ending) return;
      ctx.ending = true;
      await endAutoRun({ status, finalOutput: output });
    };

    res.on("finish", () => {
      const ok = res.statusCode < 400;
      void finish(ok ? "success" : "error", `HTTP ${res.statusCode}`);
    });

    if (next) {
      runInContextAsync(ctx, () =>
        Promise.resolve(next()).catch(async (error: unknown) => {
          await finish(
            "error",
            error instanceof Error ? error.message : String(error)
          );
          throw error;
        })
      ).catch((error) => {
        if (next) next(error);
      });
      return;
    }
  };
}

export default agentLoggerMiddleware;

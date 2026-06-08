import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  detectLlmRequest,
  extractUsage,
} from "./detect.js";
import { sanitizeBody, truncateValue } from "./sanitize.js";
import { wrapTool, instrumentTools } from "./tools.js";
import {
  enableAutoInstrumentation,
  resetAutoInstrumentationForTests,
} from "./instrument.js";
import { unpatchFetchForTests } from "./fetch.js";
import { resetLifecycleForTests } from "./lifecycle.js";
import { resetErrorHandlersForTests } from "./errors.js";
import {
  resetForTests,
  getPendingBatch,
  flush,
} from "../index.js";

describe("detect", () => {
  it("detects OpenAI-style request bodies", () => {
    const body = {
      model: "gpt-4o",
      messages: [{ role: "user", content: "hi" }],
    };
    const result = detectLlmRequest(
      "https://api.openai.com/v1/chat/completions",
      { method: "POST", body: JSON.stringify(body) },
      body
    );
    expect(result.isLlm).toBe(true);
    expect(result.model).toBe("gpt-4o");
  });

  it("detects Ollama-style localhost bodies", () => {
    const body = { model: "llama3", messages: [{ role: "user", content: "hi" }] };
    const result = detectLlmRequest(
      "http://localhost:11434/api/chat",
      { method: "POST" },
      body
    );
    expect(result.isLlm).toBe(true);
  });

  it("ignores localhost without LLM body", () => {
    const result = detectLlmRequest("http://localhost:3000/api/health", {}, null);
    expect(result.isLlm).toBe(false);
  });

  it("extracts OpenAI usage", () => {
    expect(
      extractUsage({ usage: { total_tokens: 100, prompt_tokens: 40, completion_tokens: 60 } })
    ).toEqual({
      totalTokens: 100,
      promptTokens: 40,
      completionTokens: 60,
    });
  });

  it("extracts Anthropic usage", () => {
    expect(extractUsage({ usage: { input_tokens: 10, output_tokens: 20 } })).toEqual({
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
    });
  });
});

describe("sanitize", () => {
  it("redacts secret fields", () => {
    const result = sanitizeBody({ api_key: "secret", prompt: "hello" }) as Record<
      string,
      unknown
    >;
    expect(result.api_key).toBe("[REDACTED]");
    expect(result.prompt).toBe("hello");
  });

  it("truncates large payloads", () => {
    const big = { data: "x".repeat(100_000) };
    const result = truncateValue(big, 1000) as Record<string, unknown>;
    expect(result._agentlogger_truncated).toBe(true);
  });
});

describe("tools", () => {
  beforeEach(() => {
    resetForTests();
    resetLifecycleForTests();
    resetAutoInstrumentationForTests();
    resetErrorHandlersForTests();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 202, text: async () => "" }));
    enableAutoInstrumentation();
  });

  afterEach(() => {
    unpatchFetchForTests();
    vi.unstubAllGlobals();
  });

  it("wrapTool logs success", async () => {
    const fn = wrapTool("getWeather", async (city: string) => ({ city, temp: 72 }));
    await fn("NYC");
    const batch = getPendingBatch();
    expect(batch.toolCalls?.length).toBe(1);
    expect(batch.toolCalls?.[0].tool_name).toBe("getWeather");
    expect(batch.toolCalls?.[0].success).toBe(true);
  });

  it("instrumentTools wraps all functions", async () => {
    const tools = instrumentTools({
      a: async () => 1,
      b: async () => 2,
    });
    await tools.a();
    await tools.b();
    expect(getPendingBatch().toolCalls?.length).toBe(2);
  });
});

describe("fetch patch", () => {
  const mockOriginal = vi.fn();

  beforeEach(() => {
    resetForTests();
    resetLifecycleForTests();
    resetAutoInstrumentationForTests();
    resetErrorHandlersForTests();
    mockOriginal.mockReset();
    mockOriginal.mockImplementation(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "hello" } }],
          usage: { total_tokens: 10 },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", mockOriginal);
    enableAutoInstrumentation();
  });

  afterEach(() => {
    unpatchFetchForTests();
    vi.unstubAllGlobals();
  });

  it("traces LLM fetch calls", async () => {
    await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: "hi" }],
      }),
    });

    const batch = getPendingBatch();
    expect(batch.runs?.length).toBeGreaterThan(0);
    expect(batch.steps?.length).toBe(1);
    expect(batch.steps?.[0].step_type).toBe("llm");
  });

  it("does not trace non-LLM fetch", async () => {
    await fetch("https://example.com/api/data");
    const batch = getPendingBatch();
    expect(batch.steps?.length ?? 0).toBe(0);
  });

  it("ends auto run after idle period when LLM fetch completes", async () => {
    vi.useFakeTimers();
    process.env.AGENTLOGGER_AUTO_END_IDLE_MS = "1000";

    try {
      await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [{ role: "user", content: "hi" }],
        }),
      });

      expect(getPendingBatch().runs?.[0]?.status).toBe("running");

      await vi.advanceTimersByTimeAsync(1000);

      const ingestCalls = mockOriginal.mock.calls.filter((call) =>
        String(call[0]).includes("/api/v1/ingest")
      );
      const lastIngest = ingestCalls.at(-1)?.[1]?.body;
      const payload =
        typeof lastIngest === "string" ? JSON.parse(lastIngest) : null;
      expect(payload?.runs?.[0]?.status).toBe("success");
      expect(payload?.runs?.[0]?.final_output).toBe("hello");
    } finally {
      vi.useRealTimers();
      delete process.env.AGENTLOGGER_AUTO_END_IDLE_MS;
      resetLifecycleForTests();
    }
  });
});

describe("fail-open flush", () => {
  beforeEach(() => {
    vi.useRealTimers();
    resetForTests();
    resetLifecycleForTests();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down"))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetLifecycleForTests();
  });

  it("does not throw when failOpen is enabled", async () => {
    const { init, startRun } = await import("../index.js");
    init({
      projectId: "test",
      failOpen: true,
      baseUrl: "http://localhost:3000",
      apiKey: "key",
    });
    const run = startRun({ userInput: "test" });
    await expect(run.end()).resolves.toBeUndefined();
  });
});

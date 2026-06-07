import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  init,
  startRun,
  withRun,
  flush,
  resetForTests,
  isInitialized,
} from "./index.js";

const mockFetch = vi.fn();

beforeEach(() => {
  resetForTests();
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
  init({
    apiKey: "test-key",
    baseUrl: "http://localhost:3000",
    projectId: "test-project",
    environment: "test",
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SDK", () => {
  it("queues correct payload shape on run.end", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 202,
      text: async () => "",
    });

    const run = startRun({
      userInput: "Hello",
      metadata: { version: "1.0.0" },
    });

    const step = run.startStep({ type: "llm", name: "think", input: { q: "Hello" } });
    step.end({ output: { a: "Hi" } });

    run.logToolCall({
      toolName: "search",
      input: { query: "test" },
      output: { results: [] },
      success: true,
      durationMs: 100,
      stepId: step.stepId,
    });

    await run.end({ finalOutput: "Done", tokens: 50, cost: 0.001 });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("http://localhost:3000/api/v1/ingest");
    expect(options.headers.Authorization).toBe("Bearer test-key");

    const body = JSON.parse(options.body);
    expect(body.runs).toHaveLength(1);
    expect(body.runs[0].user_input).toBe("Hello");
    expect(body.runs[0].status).toBe("success");
    expect(body.runs[0].total_latency).toBeGreaterThanOrEqual(0);
    expect(body.runs[0].total_tokens).toBe(50);
    expect(body.steps).toHaveLength(1);
    expect(body.toolCalls).toHaveLength(1);
  });

  it("sets error_message on failed step", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 202, text: async () => "" });

    const run = startRun({ userInput: "Fail test" });
    const step = run.startStep({ type: "tool", name: "fetch", input: {} });
    step.fail({ error: "Timeout" });
    await run.end({ status: "error" });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.steps[0].error_message).toBe("Timeout");
    expect(body.runs[0].status).toBe("error");
  });

  it("retries fetch on network error", async () => {
    mockFetch
      .mockRejectedValueOnce(new Error("network"))
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ ok: true, status: 202, text: async () => "" });

    const run = startRun({ userInput: "retry test" });
    await run.end();

    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("withRun ends with success on completion", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 202, text: async () => "" });

    const result = await withRun({ userInput: "wrapped" }, async (run) => {
      run.startStep({ type: "llm", name: "answer" }).end({ output: "ok" });
      return "result-value";
    });

    expect(result).toBe("result-value");
    expect(mockFetch).toHaveBeenCalled();
  });

  it("withRun ends with error status on throw", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 202, text: async () => "" });

    await expect(
      withRun({ userInput: "error wrap" }, async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");

    expect(mockFetch).toHaveBeenCalled();
  });

  it("throws if init not called", () => {
    resetForTests();
    expect(() => startRun({ userInput: "x" })).toThrow("not initialized");
  });

  it("recordUsage accumulates tokens on run", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 202, text: async () => "" });
    const run = startRun({ userInput: "usage" });
    run.recordUsage({ totalTokens: 50, model: "gpt-4o" });
    run.recordUsage({ promptTokens: 10, completionTokens: 5 });
    await run.end();
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.runs[0].total_tokens).toBe(65);
  });

  it("isInitialized reflects init state", () => {
    expect(isInitialized()).toBe(true);
    resetForTests();
    expect(isInitialized()).toBe(false);
  });

  it("incremental flush keeps running runs", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 202, text: async () => "" });
    const run = startRun({ userInput: "partial" });
    run.startStep({ type: "llm", name: "a" }).end({ output: "x" });
    await flush({ keepRunningRuns: true });
    run.startStep({ type: "llm", name: "b" }).end({ output: "y" });
    await run.end();
    expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});

describe("SDK contract exports", () => {
  it("exports stable public API", () => {
    expect(typeof init).toBe("function");
    expect(typeof startRun).toBe("function");
    expect(typeof withRun).toBe("function");
    expect(typeof flush).toBe("function");
  });
});

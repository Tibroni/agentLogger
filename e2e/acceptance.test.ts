import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const webDir = path.join(rootDir, "apps/web");
const API_KEY = "e2e-test-key";
const BASE_URL = "http://localhost:3099";

let serverProcess: ChildProcess | null = null;

async function waitForHealth(maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${BASE_URL}/api/v1/health`);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Server did not become healthy");
}

beforeAll(async () => {
  process.env.OBSERVABILITY_API_KEY = API_KEY;
  process.env.DATABASE_URL = "file:./e2e.db";

  const { execSync } = await import("child_process");
  execSync("pnpm exec prisma db push --skip-generate", {
    cwd: webDir,
    env: { ...process.env, DATABASE_URL: "file:./e2e.db" },
    stdio: "pipe",
  });
  execSync("pnpm exec prisma generate", { cwd: webDir, stdio: "pipe" });
  execSync("pnpm exec next build", {
    cwd: webDir,
    env: { ...process.env, DATABASE_URL: "file:./e2e.db" },
    stdio: "pipe",
  });

  serverProcess = spawn("pnpm", ["exec", "next", "start", "-p", "3099"], {
    cwd: webDir,
    env: {
      ...process.env,
      OBSERVABILITY_API_KEY: API_KEY,
      DATABASE_URL: "file:./e2e.db",
      PORT: "3099",
    },
    stdio: "pipe",
  });

  await waitForHealth();
}, 60000);

afterAll(async () => {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
  }
  try {
    const { execSync } = await import("child_process");
    execSync("rm -f e2e.db e2e.db-journal", { cwd: webDir });
  } catch {
    // ignore
  }
});

describe("E2E acceptance criteria", () => {
  it("AC1: SDK install + traces appear with minimal setup", async () => {
    const { init, startRun } = await import("@agentlogger/sdk");

    init({
      apiKey: API_KEY,
      baseUrl: BASE_URL,
      projectId: "e2e-project",
    });

    const run = startRun({ userInput: "E2E test input" });
    run.startStep({ type: "llm", name: "step1" }).end({ output: "ok" });
    await run.end({ finalOutput: "E2E output" });

    const listRes = await fetch(`${BASE_URL}/api/v1/runs?run_id=${run.runId.slice(0, 8)}`);
    const list = await listRes.json();
    expect(list.runs.some((r: { run_id: string }) => r.run_id === run.runId)).toBe(true);
  });

  it("AC2: Run shows input, steps, tool calls, and output", async () => {
    const { init, startRun } = await import("@agentlogger/sdk");

    init({ apiKey: API_KEY, baseUrl: BASE_URL, projectId: "e2e-full" });

    const run = startRun({ userInput: "Full trace test" });
    const step = run.startStep({ type: "tool", name: "search", input: { q: "test" } });
    step.end({ output: { found: true } });
    run.logToolCall({
      toolName: "search_api",
      input: { q: "test" },
      output: { items: [1] },
      success: true,
      stepId: step.stepId,
    });
    await run.end({ finalOutput: "Found results" });

    const detailRes = await fetch(`${BASE_URL}/api/v1/runs/${run.runId}`);
    const detail = await detailRes.json();

    expect(detail.run.user_input).toBe("Full trace test");
    expect(detail.run.final_output).toBe("Found results");
    expect(detail.steps.length).toBeGreaterThan(0);
    expect(detail.toolCalls.length).toBeGreaterThan(0);
  });

  it("AC3: Search and filter past runs", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/runs?project_id=e2e-full`);
    const body = await res.json();
    expect(body.runs.length).toBeGreaterThan(0);
    expect(body.metrics).toBeDefined();
  });

  it("AC4: Score runs with manual evaluation", async () => {
    const listRes = await fetch(`${BASE_URL}/api/v1/runs?limit=1`);
    const list = await listRes.json();
    const runId = list.runs[0].run_id;

    const evalRes = await fetch(`${BASE_URL}/api/v1/runs/${runId}/evaluations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({ comments: "E2E eval", score: 1 }),
    });
    expect(evalRes.status).toBe(201);

    const detailRes = await fetch(`${BASE_URL}/api/v1/runs/${runId}`);
    const detail = await detailRes.json();
    expect(detail.evaluations.some((e: { comments?: string }) => e.comments === "E2E eval")).toBe(true);
  });

  it("AC5: Reusable SDK pattern via stable exports", async () => {
    const sdk = await import("@agentlogger/sdk");
    expect(typeof sdk.init).toBe("function");
    expect(typeof sdk.startRun).toBe("function");
    expect(typeof sdk.withRun).toBe("function");
  });
});

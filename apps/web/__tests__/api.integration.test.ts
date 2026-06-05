// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import ingestFixture from "../../../packages/core/__fixtures__/ingest-batch-v1.json";
import { POST as ingestPost } from "../app/api/v1/ingest/route";
import { GET as runsGet } from "../app/api/v1/runs/route";
import { GET as runGet } from "../app/api/v1/runs/[runId]/route";
import { POST as evalPost } from "../app/api/v1/runs/[runId]/evaluations/route";
import { GET as exportGet } from "../app/api/v1/runs/[runId]/export/route";
import { GET as healthGet } from "../app/api/v1/health/route";
import { prisma } from "../lib/prisma";

const API_KEY = "test-api-key";
const RUN_ID = "550e8400-e29b-41d4-a716-446655440000";

function authHeaders() {
  return { authorization: `Bearer ${API_KEY}` };
}

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

beforeEach(async () => {
  await prisma.evaluation.deleteMany();
  await prisma.toolCall.deleteMany();
  await prisma.step.deleteMany();
  await prisma.run.deleteMany();
});

async function seedFixture() {
  await ingestPost(
    makeRequest("http://localhost:3000/api/v1/ingest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify(ingestFixture),
    })
  );
}

describe("API integration", () => {
  it("GET /api/v1/health returns ok", async () => {
    const response = await healthGet();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
  });

  it("POST /api/v1/ingest rejects missing API key", async () => {
    const response = await ingestPost(
      makeRequest("http://localhost:3000/api/v1/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ingestFixture),
      })
    );
    expect(response.status).toBe(401);
  });

  it("POST /api/v1/ingest rejects invalid payload", async () => {
    const response = await ingestPost(
      makeRequest("http://localhost:3000/api/v1/ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ runs: [{ run_id: "bad" }] }),
      })
    );
    expect(response.status).toBe(400);
  });

  it("POST /api/v1/ingest stores trace and GET returns it", async () => {
    const ingestResponse = await ingestPost(
      makeRequest("http://localhost:3000/api/v1/ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify(ingestFixture),
      })
    );
    expect(ingestResponse.status).toBe(202);

    const detailResponse = await runGet(
      makeRequest(`http://localhost:3000/api/v1/runs/${RUN_ID}`),
      { params: Promise.resolve({ runId: RUN_ID }) }
    );
    expect(detailResponse.status).toBe(200);

    const detail = await detailResponse.json();
    expect(detail.run.user_input).toBe("What is the weather in NYC?");
    expect(detail.steps).toHaveLength(1);
    expect(detail.toolCalls).toHaveLength(1);
    expect(detail.evaluations).toHaveLength(1);
  });

  it("GET /api/v1/runs filters by run_id prefix", async () => {
    await seedFixture();

    const response = await runsGet(
      makeRequest("http://localhost:3000/api/v1/runs?run_id=550e8400")
    );
    const body = await response.json();
    expect(body.runs.length).toBeGreaterThan(0);
    expect(body.runs[0].run_id).toBe(RUN_ID);
    expect(body.metrics).toBeDefined();
    expect(body.metrics.total_runs).toBeGreaterThan(0);
  });

  it("GET /api/v1/runs filters by project_id", async () => {
    await seedFixture();

    const response = await runsGet(
      makeRequest(
        "http://localhost:3000/api/v1/runs?project_id=demo-project"
      )
    );
    const body = await response.json();
    expect(body.runs.every((r: { project_id: string }) => r.project_id === "demo-project")).toBe(true);

    const other = await runsGet(
      makeRequest(
        "http://localhost:3000/api/v1/runs?project_id=nonexistent-project"
      )
    );
    const otherBody = await other.json();
    expect(otherBody.runs).toHaveLength(0);
  });

  it("POST /api/v1/runs/[runId]/evaluations adds manual eval", async () => {
    await seedFixture();

    const response = await evalPost(
      makeRequest(`http://localhost:3000/api/v1/runs/${RUN_ID}/evaluations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          comments: "Integration test eval",
          score: 0.9,
          reviewer: "test",
        }),
      }),
      { params: Promise.resolve({ runId: RUN_ID }) }
    );
    expect(response.status).toBe(201);

    const detailResponse = await runGet(
      makeRequest(`http://localhost:3000/api/v1/runs/${RUN_ID}`),
      { params: Promise.resolve({ runId: RUN_ID }) }
    );
    const detail = await detailResponse.json();
    expect(
      detail.evaluations.some(
        (e: { comments?: string }) => e.comments === "Integration test eval"
      )
    ).toBe(true);
  });

  it("GET /api/v1/runs/[runId]/export returns JSON", async () => {
    await seedFixture();

    const response = await exportGet(
      makeRequest(
        `http://localhost:3000/api/v1/runs/${RUN_ID}/export?format=json`
      ),
      { params: Promise.resolve({ runId: RUN_ID }) }
    );
    expect(response.status).toBe(200);
    const text = await response.text();
    const data = JSON.parse(text);
    expect(data.run.run_id).toBe(RUN_ID);
    expect(data.steps).toBeDefined();
    expect(data.toolCalls).toBeDefined();
  });
});

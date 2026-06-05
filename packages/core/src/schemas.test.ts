import { describe, it, expect } from "vitest";
import ingestFixture from "../__fixtures__/ingest-batch-v1.json";
import {
  RunSchema,
  StepSchema,
  ToolCallSchema,
  EvaluationSchema,
  IngestBatchV1Schema,
  RunStatusSchema,
  safeParseIngestBatch,
  parseIngestBatch,
  CreateEvaluationSchema,
  RunListQuerySchema,
} from "../src/index.js";

describe("RunSchema", () => {
  it("accepts a valid run", () => {
    const run = ingestFixture.runs[0];
    expect(RunSchema.parse(run)).toEqual(run);
  });

  it("rejects invalid status", () => {
    expect(() =>
      RunSchema.parse({ ...ingestFixture.runs[0], status: "pending" })
    ).toThrow();
  });

  it("rejects missing required fields", () => {
    expect(() =>
      RunSchema.parse({ run_id: "550e8400-e29b-41d4-a716-446655440000" })
    ).toThrow();
  });
});

describe("RunStatusSchema", () => {
  it("accepts running, success, error", () => {
    expect(RunStatusSchema.parse("running")).toBe("running");
    expect(RunStatusSchema.parse("success")).toBe("success");
    expect(RunStatusSchema.parse("error")).toBe("error");
  });
});

describe("StepSchema", () => {
  it("accepts a valid step", () => {
    const step = ingestFixture.steps[0];
    expect(StepSchema.parse(step)).toEqual(step);
  });

  it("accepts step with error_message", () => {
    const step = {
      ...ingestFixture.steps[0],
      error_message: "Tool timeout",
      output_payload: undefined,
    };
    expect(StepSchema.parse(step).error_message).toBe("Tool timeout");
  });
});

describe("ToolCallSchema", () => {
  it("accepts a valid tool call", () => {
    const toolCall = ingestFixture.toolCalls[0];
    expect(ToolCallSchema.parse(toolCall)).toEqual(toolCall);
  });
});

describe("EvaluationSchema", () => {
  it("accepts a valid evaluation", () => {
    const evaluation = ingestFixture.evaluations[0];
    expect(EvaluationSchema.parse(evaluation)).toEqual(evaluation);
  });
});

describe("IngestBatchV1Schema", () => {
  it("accepts golden fixture", () => {
    const result = parseIngestBatch(ingestFixture);
    expect(result.runs).toHaveLength(1);
    expect(result.steps).toHaveLength(1);
    expect(result.toolCalls).toHaveLength(1);
    expect(result.evaluations).toHaveLength(1);
  });

  it("rejects empty batch", () => {
    const result = safeParseIngestBatch({});
    expect(result.success).toBe(false);
  });

  it("rejects invalid nested run", () => {
    const result = safeParseIngestBatch({
      runs: [{ run_id: "not-a-uuid" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("CreateEvaluationSchema", () => {
  it("defaults eval_type to manual", () => {
    const result = CreateEvaluationSchema.parse({ comments: "Looks good" });
    expect(result.eval_type).toBe("manual");
  });
});

describe("RunListQuerySchema", () => {
  it("applies defaults for limit and offset", () => {
    const result = RunListQuerySchema.parse({});
    expect(result.limit).toBe(50);
    expect(result.offset).toBe(0);
  });

  it("coerces limit from string", () => {
    const result = RunListQuerySchema.parse({ limit: "10" });
    expect(result.limit).toBe(10);
  });
});

describe("contract: golden fixture round-trip", () => {
  it("IngestBatchV1Schema.parse matches fixture structure", () => {
    const parsed = IngestBatchV1Schema.parse(ingestFixture);
    expect(parsed).toMatchObject(ingestFixture);
  });
});

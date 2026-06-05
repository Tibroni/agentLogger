import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RunDetailView, type RunDetailData } from "../components/RunDetailView";

const fixture: RunDetailData = {
  run: {
    run_id: "550e8400-e29b-41d4-a716-446655440000",
    project_id: "demo-project",
    environment: "development",
    user_input: "What is the weather in NYC?",
    start_time: "2025-06-01T10:00:00.000Z",
    end_time: "2025-06-01T10:00:02.500Z",
    total_latency: 2500,
    total_tokens: 150,
    total_cost: 0.002,
    status: "success",
    final_output: "The weather in NYC is sunny, 72°F.",
    metadata: { version: "1.0.0" },
  },
  steps: [
    {
      step_id: "660e8400-e29b-41d4-a716-446655440001",
      run_id: "550e8400-e29b-41d4-a716-446655440000",
      step_type: "llm",
      step_name: "plan",
      input_payload: { prompt: "What is the weather in NYC?" },
      output_payload: { plan: "call weather tool" },
      timestamp: "2025-06-01T10:00:00.500Z",
      duration_ms: 500,
    },
  ],
  toolCalls: [
    {
      tool_call_id: "770e8400-e29b-41d4-a716-446655440002",
      run_id: "550e8400-e29b-41d4-a716-446655440000",
      step_id: "660e8400-e29b-41d4-a716-446655440001",
      tool_name: "get_weather",
      input: { city: "NYC" },
      output: { temp_f: 72, condition: "sunny" },
      success: true,
      duration_ms: 1200,
      timestamp: "2025-06-01T10:00:01.000Z",
    },
  ],
  evaluations: [],
};

describe("RunDetailView", () => {
  it("renders user input, steps, and final output", () => {
    render(<RunDetailView detail={fixture} />);

    expect(screen.getByText("What is the weather in NYC?")).toBeInTheDocument();
    expect(screen.getByText("The weather in NYC is sunny, 72°F.")).toBeInTheDocument();
    expect(screen.getByText("plan")).toBeInTheDocument();
  });

  it("expands step to show tool call details", () => {
    render(<RunDetailView detail={fixture} />);

    fireEvent.click(screen.getByText("plan"));
    expect(screen.getByText("get_weather")).toBeInTheDocument();
    expect(screen.getAllByText("success").length).toBeGreaterThan(0);
  });
});

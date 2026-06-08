import type { Run, Step, ToolCall } from "@agentlogger/core";

export interface AutoEvalResult {
  score: number;
  rubric_name: string;
  reviewer: string;
  comments: string;
}

export function runAutomatedEvaluation(detail: {
  run: Run;
  steps: Step[];
  toolCalls: ToolCall[];
}): AutoEvalResult {
  const { run, steps, toolCalls } = detail;
  let score = 0;
  const notes: string[] = [];

  if (run.status === "success") {
    score += 0.35;
    notes.push("Run completed successfully.");
  } else {
    notes.push(`Run ended with status: ${run.status}.`);
  }

  const llmSteps = steps.filter((s) => s.step_type === "llm");
  if (llmSteps.length > 0) {
    score += 0.2;
    notes.push(`${llmSteps.length} LLM step(s) recorded.`);
  } else {
    notes.push("No LLM steps recorded.");
  }

  const failedTools = toolCalls.filter((t) => !t.success);
  if (failedTools.length === 0 && toolCalls.length > 0) {
    score += 0.2;
    notes.push("All tool calls succeeded.");
  } else if (failedTools.length > 0) {
    notes.push(`${failedTools.length} tool call(s) failed.`);
  }

  if (run.final_output && run.final_output.trim().length > 0) {
    score += 0.15;
    notes.push("Final output present.");
  } else {
    notes.push("Missing final output.");
  }

  const nearLimit = llmSteps.some((s) => {
    if (s.input_token_estimate == null || s.context_limit == null) return false;
    return s.input_token_estimate / s.context_limit >= 0.85;
  });
  if (nearLimit) {
    score -= 0.1;
    notes.push("Warning: prompt near context window limit.");
  }

  const errorSteps = steps.filter((s) => s.error_message);
  if (errorSteps.length > 0) {
    score -= Math.min(0.3, errorSteps.length * 0.1);
    notes.push(`${errorSteps.length} step error(s).`);
  }

  score = Math.max(0, Math.min(1, score));

  return {
    score,
    rubric_name: "agent_quality_heuristic",
    reviewer: "agentlogger-auto",
    comments: notes.join(" "),
  };
}

import { init, startRun } from "@agentlogger/sdk";

init({
  apiKey: process.env.OBSERVABILITY_API_KEY ?? "dev-api-key-change-me",
  baseUrl: process.env.OBSERVABILITY_URL ?? "http://localhost:3000",
  projectId: "minimal-agent",
  environment: "development",
});

async function fakeWeatherTool(city: string) {
  await new Promise((r) => setTimeout(r, 50));
  return { temp_f: 72, condition: "sunny", city };
}

async function main() {
  const run = startRun({
    userInput: "What is the weather in NYC?",
    metadata: { version: "1.0.0", model: "demo" },
  });

  const planStep = run.startStep({
    type: "llm",
    name: "plan",
    input: { prompt: "What is the weather in NYC?" },
  });
  planStep.end({ output: { plan: "call weather tool for NYC" } });

  const toolStart = Date.now();
  const weather = await fakeWeatherTool("NYC");
  run.logToolCall({
    toolName: "get_weather",
    input: { city: "NYC" },
    output: weather,
    success: true,
    durationMs: Date.now() - toolStart,
    stepId: planStep.stepId,
  });

  const answerStep = run.startStep({
    type: "llm",
    name: "answer",
    input: { weather },
  });
  answerStep.end({
    output: { text: `The weather in NYC is ${weather.condition}, ${weather.temp_f}°F.` },
  });

  await run.end({
    finalOutput: `The weather in NYC is ${weather.condition}, ${weather.temp_f}°F.`,
    tokens: 120,
    cost: 0.0015,
  });

  console.log("Trace sent. Open http://localhost:3000/runs to view.");
  console.log("Run ID:", run.runId);
}

main().catch(console.error);

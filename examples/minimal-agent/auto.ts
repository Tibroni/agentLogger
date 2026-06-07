import "@agentlogger/sdk/auto";
import { instrumentTools } from "@agentlogger/sdk/auto";

const tools = instrumentTools({
  async getWeather(city: string) {
    await new Promise((r) => setTimeout(r, 50));
    return { temp_f: 72, condition: "sunny", city };
  },
});

async function main() {
  await fetch("https://api.example-llm.test/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-AgentLogger-Trace": "llm",
    },
    body: JSON.stringify({
      model: "demo-model",
      messages: [{ role: "user", content: "What is the weather in NYC?" }],
    }),
  }).catch(() => undefined);

  const weather = await tools.getWeather("NYC");
  console.log(`The weather in NYC is ${weather.condition}, ${weather.temp_f}°F.`);
  console.log("\nTrace sent. Open http://localhost:3000/runs and refresh.");
}

main().catch(console.error);

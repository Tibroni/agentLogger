# Agent Logger

Trace AI agent runs, tool calls, and errors — view everything in a local dashboard.

## Install

```bash
npm install agentlogger
```

One package includes:

- **SDK** — add tracing to your agent code
- **CLI** — run the dashboard locally

Requires **Node 18+**.

---

## Quick start

### 1. Start the dashboard

```bash
npx agentlogger dashboard
```

Opens **http://localhost:3000**. Data is stored at `~/.agentlogger/data.db`.

Set which app’s traces to show (must match `projectId` in your code):

```bash
export NEXT_PUBLIC_OBSERVABILITY_PROJECT_ID=my-chatbot
export OBSERVABILITY_API_KEY=dev-api-key-change-me
npx agentlogger dashboard
```

### 2. Configure your app

`.env`:

```env
OBSERVABILITY_URL=http://localhost:3000
OBSERVABILITY_API_KEY=dev-api-key-change-me
```

### 3. Activate the SDK (once at startup)

```ts
import { init, startRun } from "agentlogger";

init({
  projectId: "my-chatbot",
  apiKey: process.env.OBSERVABILITY_API_KEY,
  baseUrl: process.env.OBSERVABILITY_URL ?? "http://localhost:3000",
});
```

### 4. Trace a run

```ts
const run = startRun({ userInput: "Hello" });
const step = run.startStep({ type: "llm", name: "answer" });
step.end({ output: "Hi there" });
await run.end({ finalOutput: "Hi there" });
```

### 5. View traces

Open [http://localhost:3000/runs](http://localhost:3000/runs) and click **Refresh**.

---

## Project isolation

The dashboard shows **one project at a time**. Use the same ID in:

- SDK: `init({ projectId: "my-chatbot" })`
- Dashboard: `NEXT_PUBLIC_OBSERVABILITY_PROJECT_ID=my-chatbot`

---

## CLI commands

```bash
npx agentlogger dashboard
npx agentlogger start
npx agentlogger help
```

---

## Self-host / contribute

Clone the [GitHub repo](https://github.com/YOUR_USERNAME/agentLogger) for full source, custom deploys, and development.

```bash
git clone https://github.com/YOUR_USERNAME/agentLogger.git
cd agentLogger && pnpm install && pnpm db:push && pnpm dev:dashboard
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| No traces | Dashboard running? Same API key + projectId? Called `await run.end()`? Refresh `/runs`. |
| Wrong project’s traces | Set `NEXT_PUBLIC_OBSERVABILITY_PROJECT_ID` to match SDK `projectId`. |

---

## License

MIT

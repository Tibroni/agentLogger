# Agent Logger

**Local-first observability for AI agents.** Instrument your agent code with a lightweight SDK, run a dashboard on your machine, and inspect every run — steps, tool calls, latency, tokens, and errors — without sending data to a third party.

[![npm version](https://img.shields.io/npm/v/agentlogger.svg)](https://www.npmjs.com/package/agentlogger)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)

---

## Why Agent Logger?

Building agents means debugging chains of LLM calls, tools, and retries. Agent Logger gives you a clear timeline for each conversation:

- **See what happened** — user input, each step, tool inputs/outputs, final response
- **Stay local** — traces live in a SQLite database on your machine (`~/.agentlogger/data.db`)
- **One install** — npm package includes both the tracing SDK and the dashboard CLI
- **Project-scoped** — filter the dashboard to a single app or agent via `projectId`

No cloud account required. Works great during development and early production debugging.

---

## Features

| Area          | What you get                                                                       |
| ------------- | ---------------------------------------------------------------------------------- |
| **SDK**       | `init`, `startRun`, `withRun`, steps, tool-call logging, batch ingest with retries |
| **Dashboard** | Run list, run detail timeline, status badges, expandable step/tool payloads        |
| **CLI**       | `npx agentlogger dashboard` — bundled Next.js app, no separate install             |
| **API**       | Ingest, runs list/detail, health check, JSON export, evaluations                   |
| **Data**      | Runs, steps, tool calls, tokens/cost metadata, SQLite via Prisma                   |

---

## Install

```bash
npm install agentlogger
```

Requires **Node.js 18+**.

The package includes:

- **`agentlogger`** (import) — tracing SDK
- **`agentlogger` CLI** — local dashboard server

---

## Quick start

### 1. Start the dashboard

```bash
npx agentlogger dashboard
```

Open **http://localhost:3000**. On first run, a database is created at `~/.agentlogger/data.db`.

To scope the UI to one project (must match SDK `projectId`):

```bash
export NEXT_PUBLIC_OBSERVABILITY_PROJECT_ID=my-chatbot
export OBSERVABILITY_API_KEY=dev-api-key-change-me
npx agentlogger dashboard
```

### 2. Configure your agent

Create a `.env` file in your project:

```env
OBSERVABILITY_URL=http://localhost:3000
OBSERVABILITY_API_KEY=dev-api-key-change-me
```

### 3. Initialize the SDK once at startup

```ts
import { init, startRun } from "agentlogger";

init({
  projectId: "my-chatbot",
  apiKey: process.env.OBSERVABILITY_API_KEY,
  baseUrl: process.env.OBSERVABILITY_URL ?? "http://localhost:3000",
  environment: "development",
});
```

### 4. Trace a run

```ts
const run = startRun({
  userInput: "What is the weather in NYC?",
  metadata: { model: "gpt-4o" },
});

const plan = run.startStep({ type: "llm", name: "plan" });
plan.end({ output: { intent: "weather lookup" } });

run.logToolCall({
  toolName: "get_weather",
  input: { city: "NYC" },
  output: { temp_f: 72, condition: "sunny" },
  success: true,
  durationMs: 48,
  stepId: plan.stepId,
});

const answer = run.startStep({ type: "llm", name: "answer" });
answer.end({ output: "It's 72°F and sunny in NYC." });

await run.end({
  finalOutput: "It's 72°F and sunny in NYC.",
  tokens: 120,
  cost: 0.0015,
});
```

Or wrap an entire handler with automatic success/error handling:

```ts
import { withRun } from "agentlogger";

const result = await withRun({ userInput: "Hello" }, async (run) => {
  const step = run.startStep({ type: "llm", name: "greet" });
  step.end({ output: "Hi there!" });
  return "Hi there!";
});
```

### 5. View traces

Go to **http://localhost:3000/runs** and click **Refresh**. Open a run to see the full timeline.

---

## SDK reference

| Function                                                                       | Description                                                           |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `init(options)`                                                                | Set `projectId`, `apiKey`, `baseUrl`, and optional `environment`      |
| `startRun({ userInput, metadata? })`                                           | Begin a traced run; returns an `AgentRun` handle                      |
| `run.startStep({ type, name, input? })`                                        | Start a step; call `.end()` or `.fail()` on the returned step         |
| `run.logToolCall({ toolName, input, output?, success, durationMs?, stepId? })` | Record a tool invocation                                              |
| `run.end({ finalOutput?, status?, tokens?, cost? })`                           | Finish the run and flush traces to the dashboard                      |
| `withRun(options, fn)`                                                         | Run an async function inside a traced run (auto end on success/error) |
| `flush()`                                                                      | Manually send the pending batch (usually called by `run.end()`)       |

Traces are sent to `POST /api/v1/ingest` with `Authorization: Bearer <apiKey>`.

---

## CLI

```bash
npx agentlogger dashboard   # Start dashboard (default)
npx agentlogger start       # Alias for dashboard
npx agentlogger help        # Show commands and env vars
```

### Environment variables

| Variable                               | Default                       | Purpose                    |
| -------------------------------------- | ----------------------------- | -------------------------- |
| `PORT`                                 | `3000`                        | Dashboard port             |
| `OBSERVABILITY_API_KEY`                | `dev-api-key-change-me`       | API auth for ingest        |
| `NEXT_PUBLIC_OBSERVABILITY_API_KEY`    | same as above                 | Client-side API calls      |
| `NEXT_PUBLIC_OBSERVABILITY_PROJECT_ID` | _(none)_                      | Filter runs to one project |
| `DATABASE_URL`                         | `file:~/.agentlogger/data.db` | SQLite database path       |

---

## Project isolation

The dashboard shows **one project at a time**. Use the same identifier in both places:

- **SDK:** `init({ projectId: "my-chatbot" })`
- **Dashboard:** `NEXT_PUBLIC_OBSERVABILITY_PROJECT_ID=my-chatbot`

If `NEXT_PUBLIC_OBSERVABILITY_PROJECT_ID` is unset, the dashboard may show runs from all projects that share the same API key.

---

## Development (from source)

For contributing, custom deployments, or running the full monorepo:

```bash
git clone https://github.com/tibroni/agentLogger.git
cd agentLogger

cp .env.example .env
cp apps/web/.env.example apps/web/.env

pnpm install
pnpm db:push
pnpm dev:dashboard
```

The dashboard dev server runs at **http://localhost:3000**. Run tests with `pnpm test` and end-to-end checks with `pnpm test:e2e`.

### Repository layout

```
apps/web/              Next.js dashboard + REST API
packages/core/         Shared Zod schemas
packages/sdk/          Tracing SDK (bundled into npm package)
packages/agentlogger/  Published npm package (SDK + CLI + dashboard bundle)
examples/minimal-agent Sample traced agent
```

---

## Troubleshooting

| Problem                | What to check                                                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| No traces in dashboard | Is the dashboard running? Same `OBSERVABILITY_API_KEY` in SDK and dashboard? Did you call `await run.end()`? Refresh `/runs`. |
| Wrong project's runs   | Set `NEXT_PUBLIC_OBSERVABILITY_PROJECT_ID` to match SDK `projectId`.                                                          |
| `SDK not initialized`  | Call `init()` before `startRun()` or `withRun()`.                                                                             |
| Port already in use    | Set `PORT=3001` (or another free port) before starting the dashboard.                                                         |

---

## License

MIT

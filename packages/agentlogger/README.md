# Agent Logger

<p align="center">
  <strong>Local-first observability for AI agents</strong><br/>
  Install once, run your agent, and inspect every LLM call, tool invocation, and error — all on your machine.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/agentlogger"><img src="https://img.shields.io/npm/v/agentlogger.svg" alt="npm version" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
  <img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg" alt="Node.js 18+" />
</p>

---

## Overview

**Agent Logger** records what your AI agent does — user inputs, model calls, tool usage, latency, token counts, and failures — and displays it in a local web dashboard. No cloud account. No third-party telemetry. Data stays in a SQLite file on your computer (`~/.agentlogger/data.db`).

### Why use it?

Building agents means debugging chains of LLM calls, tools, and retries. Agent Logger gives you a clear **timeline for every run** so you can answer:

- What did the user ask?
- Which model calls were made, in what order?
- What tools ran, with what inputs and outputs?
- Where did it fail, and how long did each step take?

---

## Quick start (automatic tracing)

### 1. Install

```bash
npm install agentlogger
```

On install, Agent Logger runs a one-time setup that:

- Adds `import "agentlogger/auto"` to your project's entry file
- Creates a `.env` file with sensible defaults (if one doesn't exist)

To skip automatic setup (e.g. in CI): `AGENTLOGGER_SKIP_SETUP=1 npm install agentlogger`

### 2. Start the dashboard

```bash
npx agentlogger dashboard
```

Open **http://localhost:3000**. Scope the UI to your project:

```bash
export NEXT_PUBLIC_OBSERVABILITY_PROJECT_ID=my-agent
npx agentlogger dashboard
```

### 3. Run your agent

Run your agent as you normally would. **No manual tracing code required.**

Agent Logger automatically records:

| Event | How it's captured |
| ----- | ----------------- |
| LLM / model calls | Intercepts HTTP `fetch` requests to AI providers |
| Tool calls | Via `instrumentTools()` (auto-applied when setup detects a tools file) |
| Errors & crashes | Hooks into uncaught exceptions and failed requests |
| Run lifecycle | Starts on first activity, ends when your process exits |

Works with **any HTTP-based model** — OpenAI, Anthropic, Ollama, Groq, Together, local vLLM, custom endpoints, and more.

### 4. View traces

Go to **http://localhost:3000/runs**, click **Refresh**, and open a run to see the full timeline.

---

## How auto-instrumentation works

```text
npm install agentlogger
        │
        ▼
  postinstall setup
  • patches entry file
  • creates .env
        │
        ▼
import "agentlogger/auto"   ← runs before your code
        │
        ├── patches global fetch  → logs LLM calls (any provider)
        ├── wraps tool functions  → logs tool inputs/outputs
        └── hooks process exit    → flushes traces to dashboard
        │
        ▼
  POST /api/v1/ingest  →  SQLite  →  Dashboard UI
```

### Provider-agnostic LLM detection

Agent Logger does **not** require OpenAI or Anthropic SDKs. It watches outgoing `fetch` calls and detects LLM requests by:

- Request body shape (`model`, `messages`, `prompt`, etc.)
- Known AI provider hostnames (configurable via `AGENTLOGGER_LLM_HOSTS`)
- Opt-in header: `X-AgentLogger-Trace: llm` for custom endpoints

Token usage is extracted when present (OpenAI, Anthropic, Gemini, Ollama response formats).

### Tool tracing

Wrap your tool registry once:

```ts
import { instrumentTools } from "agentlogger/auto";

export const tools = instrumentTools({
  getWeather: async (city: string) => { /* ... */ },
  searchDocs: async (query: string) => { /* ... */ },
});
```

Or wrap individual tools: `wrapTool("getWeather", fn)`.

---

## Manual instrumentation (optional)

For full control, use the SDK directly:

```ts
import { init, startRun, withRun } from "agentlogger";

init({ projectId: "my-agent" });

const run = startRun({ userInput: "Hello" });
const step = run.startStep({ type: "llm", name: "greet" });
step.end({ output: "Hi!" });
await run.end({ finalOutput: "Hi!", tokens: 42 });
```

Or wrap an entire handler:

```ts
await withRun({ userInput: "Hello" }, async (run) => {
  run.startStep({ type: "llm", name: "answer" }).end({ output: "Hi!" });
  return "Hi!";
});
```

---

## CLI reference

```bash
npx agentlogger dashboard   # Start the local dashboard (default)
npx agentlogger setup       # Re-run project setup (patch entry, create .env)
npx agentlogger help        # Show commands and environment variables
```

---

## Configuration

### Environment variables

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `OBSERVABILITY_URL` | `http://localhost:3000` | Dashboard URL for trace ingest |
| `OBSERVABILITY_API_KEY` | `dev-api-key-change-me` | Auth key (must match dashboard) |
| `AGENTLOGGER_PROJECT_ID` | `package.json` name | Project identifier for traces |
| `AGENTLOGGER_FLUSH_INTERVAL_MS` | `3000` | How often to sync traces while a run is active |
| `AGENTLOGGER_LLM_HOSTS` | _(built-in list)_ | Extra LLM hostnames, comma-separated |
| `AGENTLOGGER_USER_INPUT` | auto-generated | Label for auto-created runs |
| `AGENTLOGGER_SKIP_SETUP` | — | Set to `1` to skip postinstall setup |
| `AGENTLOGGER_FAIL_OPEN` | `true` (auto mode) | Don't crash your agent if dashboard is down |

### Dashboard variables

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `PORT` | `3000` | Dashboard port |
| `NEXT_PUBLIC_OBSERVABILITY_PROJECT_ID` | — | Filter UI to one project |
| `DATABASE_URL` | `file:~/.agentlogger/data.db` | SQLite database path |

---

## HTTP server middleware

For agents deployed as API servers, use one traced run per request:

```ts
import express from "express";
import { agentLoggerMiddleware } from "agentlogger/middleware/http";

const app = express();
app.use(express.json());
app.use(agentLoggerMiddleware({ userInputFrom: "message" }));
```

---

## SDK reference

| Function | Description |
| -------- | ----------- |
| `init(options)` | Configure project ID, API key, base URL |
| `startRun({ userInput, metadata? })` | Begin a traced run |
| `run.startStep({ type, name, input? })` | Start a step; call `.end()` or `.fail()` |
| `run.logToolCall({ toolName, input, output?, success, durationMs? })` | Record a tool call |
| `run.recordUsage({ totalTokens?, model?, provider? })` | Accumulate token usage |
| `run.end({ finalOutput?, status?, tokens?, cost? })` | Finish run and flush traces |
| `withRun(options, fn)` | Auto end on success/error |
| `flush()` | Manually send pending batch |

### Package exports

| Import path | Purpose |
| ----------- | ------- |
| `agentlogger` | Manual SDK |
| `agentlogger/auto` | Auto-instrumentation (side-effect import) |
| `agentlogger/middleware/http` | HTTP server middleware |

---

## Project isolation

The dashboard shows **one project at a time**. Use the same ID in both places:

- **Auto mode:** `AGENTLOGGER_PROJECT_ID=my-agent` in `.env`
- **Manual SDK:** `init({ projectId: "my-agent" })`
- **Dashboard:** `NEXT_PUBLIC_OBSERVABILITY_PROJECT_ID=my-agent`

---

## Troubleshooting

| Problem | Solution |
| ------- | -------- |
| No traces in dashboard | Is `npx agentlogger dashboard` running? Same API key in `.env` and dashboard? Refresh `/runs`. |
| Wrong project's runs | Set `NEXT_PUBLIC_OBSERVABILITY_PROJECT_ID` to match `AGENTLOGGER_PROJECT_ID`. |
| Auto setup didn't patch entry | Run `npx agentlogger setup` manually, or add `import "agentlogger/auto"` yourself. |
| LLM calls not traced | Ensure requests use `fetch` with a JSON body containing `model` + `messages`. For custom endpoints, add `X-AgentLogger-Trace: llm` header or set `AGENTLOGGER_LLM_HOSTS`. |
| Agent crashes when dashboard is down | Auto mode is fail-open by default. Set `AGENTLOGGER_FAIL_OPEN=true`. |
| Port already in use | `PORT=3001 npx agentlogger dashboard` |

---

## Development (from source)

```bash
git clone https://github.com/tibroni/agentLogger.git
cd agentLogger
cp .env.example .env
cp apps/web/.env.example apps/web/.env
pnpm install
pnpm db:push
pnpm dev:dashboard
```

```bash
pnpm test          # unit + integration tests
pnpm test:e2e      # full-stack acceptance tests
pnpm build:npm     # build publishable npm package
```

### Repository layout

```text
apps/web/              Next.js dashboard + REST API
packages/core/         Shared Zod schemas
packages/sdk/          Tracing SDK + auto-instrumentation
packages/agentlogger/  Published npm package (SDK + CLI + dashboard)
examples/minimal-agent Auto and manual tracing examples
```

---

## License

MIT

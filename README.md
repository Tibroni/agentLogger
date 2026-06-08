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

Works with **any HTTP-based model** — OpenAI, Anthropic, Ollama, Groq, local vLLM, custom endpoints, and more. You are not limited to a fixed list of models.

### Why use it?

Building agents means debugging chains of LLM calls, tools, and retries. Agent Logger gives you a clear **timeline for every run** so you can answer:

- What did the user ask?
- Which model calls were made, in what order?
- What tools ran, with what inputs and outputs?
- Where did it fail, and how long did each step take?
- How many tokens did each step cost?

---

## Quick start (automatic tracing)

### 1. Install

```bash
npm install agentlogger
```

On install, Agent Logger may ask:

```text
[agentlogger] Auto-configure this project? (adds import "agentlogger/auto" to your entry file) [y/N]:
```

- **Yes** — patches your entry file and creates `.env` defaults (recommended for quick start)
- **No** — skips file edits; add `import "agentlogger/auto"` yourself, or run `npx agentlogger setup --yes` later

**Non-interactive installs** (CI, Docker, etc.) skip auto-patch by default. Traces still work after you add the import manually or run setup.

| Skip / control setup | Command |
| -------------------- | ------- |
| Skip all setup | `AGENTLOGGER_SKIP_SETUP=1 npm install agentlogger` |
| Force auto-patch (no prompt) | `AGENTLOGGER_SETUP=yes npm install agentlogger` |
| Skip patch only | `AGENTLOGGER_SETUP=no npm install agentlogger` |
| Re-run setup later | `npx agentlogger setup --yes` |

Setup also creates or updates `.env` with project ID and API key defaults.

### 2. Start the dashboard

```bash
npx agentlogger dashboard
```

Open the URL it prints (defaults to **http://localhost:3000**; picks the next free port if busy). The runs list opens immediately.

The dashboard URL is saved to `~/.agentlogger/dashboard.json` so your agent auto-connects without copying the port.

### 3. Run your agent

Run your agent as you normally would. **No manual tracing code required** (if you accepted setup or added the import).

| Event | How it's captured |
| ----- | ----------------- |
| LLM / model calls | Intercepts HTTP `fetch` requests to AI providers |
| Tool calls | Via `instrumentTools()` (auto-wrapped when setup detects a `tools` file) |
| Errors & crashes | Hooks into uncaught exceptions and failed requests |
| Run lifecycle | Starts on first activity, ends when your process exits |

### 4. View traces

Click a run to see the **agent timeline** — LLM steps with model/tokens/cost, tools, errors, and final output. Use **Compare** on the runs page to diff two runs.

---

## What's new in 1.2.0

- **Agent timeline** — visual waterfall, per-step tokens & estimated cost, prompt/response previews
- **Live refresh** — dashboard updates while a run is in progress
- **Search** — find runs by user input, output, or metadata
- **Compare runs** — side-by-side latency, tokens, and output diff
- **Auto-evaluate** — one-click heuristic quality score on a run
- **Export** — JSON, JSONL, or OpenTelemetry JSON
- **Framework helpers** — optional wrappers for OpenAI SDK, LangChain, Vercel AI
- **Context limit hints** — optional warning when a prompt is near a model's limit (configurable for any model)
- **Interactive install** — choose whether setup auto-edits your source files

---

## Security & local-only use

Agent Logger is designed for **local development**. By default:

- The dashboard binds to your machine (`localhost` / `0.0.0.0` with local access)
- The default API key is `dev-api-key-change-me`

**If you expose the dashboard on a network** (LAN, VPS, tunnel), change the API key in both your agent `.env` and when starting the dashboard:

```bash
export OBSERVABILITY_API_KEY="your-long-random-secret"
npx agentlogger dashboard
```

Sensitive fields in traces (API keys, tokens in headers) are redacted before storage.

---

## Package size

The npm package is **larger than a typical SDK** because it bundles a full local dashboard (Next.js standalone) so you can run `npx agentlogger dashboard` with zero extra setup.

**Why it's bundled:** one install gives you tracing + UI without installing Node apps separately.

**Future options to reduce size** (not yet split): SDK-only package, optional dashboard download, or running the dashboard from source. For now, the tradeoff is install size vs. zero-config local debugging.

---

## How auto-instrumentation works

```text
npm install agentlogger
        │
        ▼
  postinstall setup (optional, asks first)
  • patches entry file if you say yes
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

### Tool tracing

```ts
import { instrumentTools } from "agentlogger/auto";

export const tools = instrumentTools({
  getWeather: async (city: string) => { /* ... */ },
});
```

Or wrap individual tools: `wrapTool("getWeather", fn)`.

### Framework integrations (optional)

```ts
import { traceOpenAiChatCompletion } from "agentlogger/integrations/openai";
import { traceLangChainLlm, traceLangChainTool } from "agentlogger/integrations/langchain";
import { traceVercelAiCall } from "agentlogger/integrations/vercel-ai";
```

---

## Manual instrumentation (optional)

```ts
import { init, startRun, startChildRun, withRun } from "agentlogger";

init({ projectId: "my-agent" });

const run = startRun({ userInput: "Hello" });
const step = run.startStep({ type: "llm", name: "greet" });
step.end({ output: "Hi!" });
await run.end({ finalOutput: "Hi!" });
```

---

## CLI reference

```bash
npx agentlogger dashboard   # Start the local dashboard (default)
npx agentlogger setup       # Re-run project setup
npx agentlogger setup --yes # Auto-patch without prompting
npx agentlogger help        # Show commands and environment variables
```

---

## Configuration

### Agent / SDK variables

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `OBSERVABILITY_URL` | auto / `http://localhost:3000` | Dashboard URL; auto-reads `~/.agentlogger/dashboard.json` |
| `OBSERVABILITY_API_KEY` | `dev-api-key-change-me` | Auth key — **change if dashboard is network-accessible** |
| `AGENTLOGGER_PROJECT_ID` | `package.json` name | Project identifier for traces |
| `NEXT_PUBLIC_OBSERVABILITY_PROJECT_ID` | same as above (set by setup) | Dashboard project filter |
| `AGENTLOGGER_FLUSH_INTERVAL_MS` | `3000` | How often to sync traces while a run is active |
| `AGENTLOGGER_LLM_HOSTS` | _(built-in list)_ | Extra LLM hostnames, comma-separated |
| `AGENTLOGGER_CONTEXT_LIMITS` | — | Per-model context limits, e.g. `gpt-5=200000,llama-3=128000` |
| `AGENTLOGGER_DEFAULT_CONTEXT_LIMIT` | — | Fallback context limit for unknown models |
| `AGENTLOGGER_USER_INPUT` | auto-generated | Label for auto-created runs |
| `AGENTLOGGER_SKIP_SETUP` | — | Set to `1` to skip postinstall setup |
| `AGENTLOGGER_SETUP` | — | `yes` / `no` to force auto-patch behavior without prompt |
| `AGENTLOGGER_FAIL_OPEN` | `true` (auto mode) | Don't crash your agent if dashboard is down |

### Dashboard variables

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `PORT` | `3000` | Preferred dashboard port (uses next free port if busy) |
| `DATABASE_URL` | `file:~/.agentlogger/data.db` | SQLite database path |

---

## HTTP server middleware

One traced run per HTTP request:

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
| `startChildRun(parentRun, options)` | Begin a child run (multi-agent) |
| `run.startStep({ type, name, input? })` | Start a step; call `.end()` or `.fail()` |
| `run.logToolCall({ toolName, input, ... })` | Record a tool call |
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
| `agentlogger/integrations/openai` | OpenAI SDK wrapper |
| `agentlogger/integrations/langchain` | LangChain-style wrappers |
| `agentlogger/integrations/vercel-ai` | Vercel AI SDK wrapper |

---

## Export & compare

```bash
# Export a run
curl "/api/v1/runs/{runId}/export?format=json"    # default
curl "/api/v1/runs/{runId}/export?format=jsonl"   # fine-tuning / pipelines
curl "/api/v1/runs/{runId}/export?format=otel"    # OpenTelemetry JSON

# Compare two runs (browser)
/runs/compare?a={runIdA}&b={runIdB}&project_id=my-agent
```

---

## Troubleshooting

| Problem | Solution |
| ------- | -------- |
| No traces in dashboard | Is `npx agentlogger dashboard` running? Same API key in `.env` and dashboard? Remove stale `OBSERVABILITY_URL` from `.env`. |
| Setup didn't patch my files | You may have said no at install. Run `npx agentlogger setup --yes` or add `import "agentlogger/auto"` manually. |
| Wrong project's runs | Set `NEXT_PUBLIC_OBSERVABILITY_PROJECT_ID` to match `AGENTLOGGER_PROJECT_ID`. |
| Dashboard crashes in a Next.js project | Use `agentlogger@1.2.0` or newer. |
| LLM calls not traced | Ensure requests use `fetch`. For custom endpoints, add `X-AgentLogger-Trace: llm` or set `AGENTLOGGER_LLM_HOSTS`. |
| Agent crashes when dashboard is down | Auto mode is fail-open by default (`AGENTLOGGER_FAIL_OPEN=true`). |
| Port already in use | CLI picks the next free port and prints the URL. |

---

## Development (from source)

```bash
git clone https://github.com/Tibroni/agentLogger.git
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

The published npm package is built from this repo via `pnpm build:npm`. Cloning from GitHub uses the monorepo layout above; npm users get the prebuilt bundle.

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

MIT — see [LICENSE](LICENSE).

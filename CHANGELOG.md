# Changelog

## 1.2.0

### Dashboard
- Agent-native timeline with per-step tokens, cost, and model info
- Live refresh for in-progress runs
- Search runs by input, output, or metadata
- Compare two runs side-by-side (`/runs/compare`)
- Automated run evaluation (heuristic score)
- Export traces as JSON, JSONL, or OpenTelemetry JSON
- Jump to first failure, orphan tool call display, context-limit warnings

### SDK & CLI
- Per-step token and estimated cost tracking
- Streaming LLM response parsing and final output capture
- Retry attempt grouping on repeated LLM calls
- Isolated run per HTTP request (middleware)
- Auto `.env` loading in auto mode
- Framework helpers: OpenAI SDK, LangChain, Vercel AI
- Child runs via `startChildRun()`
- Configurable context limits via `AGENTLOGGER_CONTEXT_LIMITS`
- Interactive postinstall setup prompt (opt-in file patching)
- SQLite migration for existing `~/.agentlogger/data.db` installs

### Security
- Documented default API key risk when exposing dashboard on a network

## 1.1.1

- Fixed dashboard bundling for Next.js host projects
- Auto port selection and dashboard URL persistence
- Auto run end with `final_output` from LLM responses

## 1.1.0

- Initial public release with auto-instrumentation and local dashboard

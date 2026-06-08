import fs from "fs";
import os from "os";
import path from "path";
import { init, isInitialized } from "../index.js";
import { loadEnvFile } from "../load-env.js";

function readLastDashboardUrl(): string | undefined {
  try {
    const statePath = path.join(os.homedir(), ".agentlogger", "dashboard.json");
    const data = JSON.parse(fs.readFileSync(statePath, "utf8")) as { url?: string };
    return typeof data.url === "string" ? data.url : undefined;
  } catch {
    return undefined;
  }
}

export interface AutoInitOptions {
  projectId?: string;
  apiKey?: string;
  baseUrl?: string;
  environment?: string;
}

function readPackageName(): string | undefined {
  try {
    const pkgPath = path.join(process.cwd(), "package.json");
    const raw = fs.readFileSync(pkgPath, "utf8");
    const pkg = JSON.parse(raw) as { name?: string };
    return typeof pkg.name === "string" ? pkg.name : undefined;
  } catch {
    return undefined;
  }
}

export function autoInit(options: AutoInitOptions = {}): void {
  if (isInitialized()) return;

  loadEnvFile();

  const projectId =
    options.projectId ??
    process.env.AGENTLOGGER_PROJECT_ID ??
    readPackageName() ??
    "default-project";

  init({
    projectId,
    apiKey: options.apiKey ?? process.env.OBSERVABILITY_API_KEY,
    baseUrl:
      options.baseUrl ??
      process.env.OBSERVABILITY_URL ??
      readLastDashboardUrl(),
    environment:
      options.environment ??
      process.env.AGENTLOGGER_ENVIRONMENT ??
      process.env.NODE_ENV ??
      "development",
    failOpen: process.env.AGENTLOGGER_FAIL_OPEN !== "false",
    flushIntervalMs: Number(
      process.env.AGENTLOGGER_FLUSH_INTERVAL_MS ?? 3000
    ),
  });
}

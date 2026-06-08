import fs from "fs";
import path from "path";
import { loadEnvFile } from "./load-env.js";

function readPackageName(cwd) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf8"));
    return typeof pkg.name === "string" && pkg.name.trim() ? pkg.name.trim() : undefined;
  } catch {
    return undefined;
  }
}

/** Resolve dashboard/trace project id from env, .env, then package.json name. */
export function resolveProjectId(cwd = process.cwd()) {
  loadEnvFile(cwd);

  const fromEnv =
    process.env.OBSERVABILITY_PROJECT_ID?.trim() ||
    process.env.NEXT_PUBLIC_OBSERVABILITY_PROJECT_ID?.trim() ||
    process.env.AGENTLOGGER_PROJECT_ID?.trim();

  return fromEnv || readPackageName(cwd);
}

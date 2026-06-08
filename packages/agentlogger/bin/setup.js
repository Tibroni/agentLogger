#!/usr/bin/env node
/**
 * Post-install setup: patch entry file, create .env defaults.
 * Skip with AGENTLOGGER_SKIP_SETUP=1
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTO_IMPORT = 'import "agentlogger/auto";';

const ENV_LINES = [
  "# OBSERVABILITY_URL is optional — set after first dashboard start, or leave unset to auto-read ~/.agentlogger/dashboard.json",
  "OBSERVABILITY_API_KEY=dev-api-key-change-me",
  "# AGENTLOGGER_PROJECT_ID=your-project-name",
  "AGENTLOGGER_FLUSH_INTERVAL_MS=3000",
];

function parseArgs(argv) {
  return {
    yes: argv.includes("--yes") || argv.includes("-y"),
    noPatch: argv.includes("--no-patch"),
    entry: argv.find((a, i) => argv[i - 1] === "--entry"),
    cwd: process.cwd(),
  };
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function detectEntry(cwd) {
  const pkg = readJson(path.join(cwd, "package.json"));
  if (!pkg) return null;

  const candidates = [];
  if (typeof pkg.main === "string") candidates.push(pkg.main);
  if (typeof pkg.module === "string") candidates.push(pkg.module);

  const startScript =
    typeof pkg.scripts?.start === "string" ? pkg.scripts.start : "";
  const nodeMatch = startScript.match(/\b(?:node|tsx|ts-node)\s+(\S+)/);
  if (nodeMatch) candidates.push(nodeMatch[1]);

  for (const rel of [
    ...candidates,
    "src/index.ts",
    "src/index.js",
    "src/main.ts",
    "index.ts",
    "index.js",
  ]) {
    if (!rel) continue;
    const full = path.join(cwd, rel.replace(/^\.\//, ""));
    if (fs.existsSync(full)) return full;
  }
  return null;
}

function patchEntry(entryPath, { yes }) {
  const content = fs.readFileSync(entryPath, "utf8");
  if (content.includes("agentlogger/auto")) {
    console.log("[agentlogger] Entry already configured:", path.basename(entryPath));
    return false;
  }

  const updated = `${AUTO_IMPORT}\n${content}`;
  fs.writeFileSync(entryPath, updated, "utf8");
  console.log("[agentlogger] Added auto-instrumentation to", path.basename(entryPath));
  return true;
}

function ensureEnv(cwd, projectName) {
  const envPath = path.join(cwd, ".env");
  const lines = [...ENV_LINES];
  if (projectName) {
    lines[2] = `AGENTLOGGER_PROJECT_ID=${projectName}`;
  }

  if (!fs.existsSync(envPath)) {
    fs.writeFileSync(envPath, `${lines.join("\n")}\n`, "utf8");
    console.log("[agentlogger] Created .env with defaults");
    return;
  }

  const existing = fs.readFileSync(envPath, "utf8");
  const missing = lines.filter((line) => {
    if (line.startsWith("#")) return false;
    const key = line.split("=")[0];
    return !existing.includes(`${key}=`);
  });

  if (missing.length) {
    fs.appendFileSync(envPath, `\n# Agent Logger\n${missing.join("\n")}\n`, "utf8");
    console.log("[agentlogger] Appended missing keys to .env");
  }
}

export function runSetup(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv);
  const cwd = opts.cwd;

  if (process.env.AGENTLOGGER_SKIP_SETUP === "1") {
    return { skipped: true };
  }

  const pkg = readJson(path.join(cwd, "package.json"));
  const projectName = typeof pkg?.name === "string" ? pkg.name : undefined;

  ensureEnv(cwd, projectName);

  if (opts.noPatch) {
    console.log("[agentlogger] Skipped entry patch (--no-patch)");
    return { patched: false };
  }

  const entry = opts.entry ?? detectEntry(cwd);
  if (!entry) {
    console.log(
      "[agentlogger] Could not detect entry file. Add manually:\n  import \"agentlogger/auto\";"
    );
    return { patched: false };
  }

  const patched = patchEntry(entry, { yes: opts.yes });
  console.log("\n[agentlogger] Next steps:");
  console.log("  1. npx agentlogger dashboard");
  console.log("  2. Run your agent as usual — traces are recorded automatically\n");

  return { patched, entry };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__dirname, "setup.js")) {
  runSetup();
}

#!/usr/bin/env node
/**
 * Post-install setup: optional patch entry file, create .env defaults, auto-wrap tools.
 * Skip entirely: AGENTLOGGER_SKIP_SETUP=1
 * Force patch without prompt: AGENTLOGGER_SETUP=yes or npx agentlogger setup --yes
 * Skip patch: AGENTLOGGER_SETUP=no or npx agentlogger setup --no-patch
 */
import fs from "fs";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTO_IMPORT = 'import "agentlogger/auto";';

function buildEnvLines(projectName) {
  const lines = [
    "# OBSERVABILITY_URL is optional — auto-reads ~/.agentlogger/dashboard.json after dashboard starts",
    "OBSERVABILITY_API_KEY=dev-api-key-change-me",
    projectName
      ? `AGENTLOGGER_PROJECT_ID=${projectName}`
      : "# AGENTLOGGER_PROJECT_ID=your-project-name",
    "AGENTLOGGER_FLUSH_INTERVAL_MS=3000",
  ];
  if (projectName) {
    lines.push(`NEXT_PUBLIC_OBSERVABILITY_PROJECT_ID=${projectName}`);
  }
  return lines;
}

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

function detectToolsFile(cwd) {
  for (const rel of [
    "src/tools.ts",
    "src/tools.js",
    "tools.ts",
    "tools.js",
    "lib/tools.ts",
    "lib/tools.js",
  ]) {
    const full = path.join(cwd, rel);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

function tryPatchToolsFile(toolsPath) {
  let content = fs.readFileSync(toolsPath, "utf8");
  if (content.includes("instrumentTools")) {
    console.log("[agentlogger] Tools file already instrumented:", path.basename(toolsPath));
    return false;
  }

  if (!/export\s+const\s+tools\s*=\s*\{/.test(content)) {
    return false;
  }

  if (!content.includes('from "agentlogger/auto"') && !content.includes("from 'agentlogger/auto'")) {
    content = `import { instrumentTools } from "agentlogger/auto";\n${content}`;
  }

  content = content.replace(
    /export\s+const\s+tools\s*=\s*\{/,
    "export const tools = instrumentTools({"
  );

  const lastBrace = content.lastIndexOf("};");
  if (lastBrace >= 0) {
    content = `${content.slice(0, lastBrace)}});${content.slice(lastBrace + 2)}`;
  } else {
    content = content.replace(/\}\s*;?\s*$/, "});");
  }

  fs.writeFileSync(toolsPath, content, "utf8");
  console.log("[agentlogger] Wrapped tools with instrumentTools in", path.basename(toolsPath));
  return true;
}

function patchEntry(entryPath) {
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
  const lines = buildEnvLines(projectName);

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

function askYesNo(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(/^y(es)?$/i.test(answer.trim()));
    });
  });
}

async function resolveShouldPatch(opts) {
  if (opts.yes) return true;
  if (opts.noPatch) return false;

  const envPref = process.env.AGENTLOGGER_SETUP?.toLowerCase();
  if (envPref === "yes" || envPref === "true" || envPref === "1") return true;
  if (envPref === "no" || envPref === "false" || envPref === "0") return false;

  if (process.stdin.isTTY) {
    return askYesNo(
      "[agentlogger] Auto-configure this project? (adds import \"agentlogger/auto\" to your entry file) [y/N]: "
    );
  }

  console.log(
    "[agentlogger] Non-interactive install — skipped auto-patch. Run: npx agentlogger setup"
  );
  return false;
}

export async function runSetup(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv);
  const cwd = opts.cwd;

  if (process.env.AGENTLOGGER_SKIP_SETUP === "1") {
    return { skipped: true };
  }

  const pkg = readJson(path.join(cwd, "package.json"));
  const projectName = typeof pkg?.name === "string" ? pkg.name : undefined;

  ensureEnv(cwd, projectName);

  const shouldPatch = await resolveShouldPatch(opts);
  let patched = false;

  if (shouldPatch) {
    const toolsPath = detectToolsFile(cwd);
    if (toolsPath) tryPatchToolsFile(toolsPath);

    const entry = opts.entry ?? detectEntry(cwd);
    if (!entry) {
      console.log(
        "[agentlogger] Could not detect entry file. Add manually:\n  import \"agentlogger/auto\";"
      );
    } else {
      patched = patchEntry(entry);
    }
  } else if (!opts.noPatch && !opts.yes) {
    console.log(
      "[agentlogger] Skipped auto-patch. To enable later: npx agentlogger setup --yes"
    );
    console.log(
      "[agentlogger] Or add manually to your entry file: import \"agentlogger/auto\";"
    );
  } else {
    console.log("[agentlogger] Skipped entry patch (--no-patch)");
  }

  console.log("\n[agentlogger] Next steps:");
  console.log("  1. npx agentlogger dashboard");
  console.log("  2. Run your agent as usual — traces are recorded automatically\n");

  return { patched };
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__dirname, "setup.js");

if (isMain) {
  runSetup().catch((error) => {
    console.error("[agentlogger] Setup failed:", error);
    process.exit(1);
  });
}

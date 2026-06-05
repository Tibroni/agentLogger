#!/usr/bin/env node
import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bundleRoot = path.join(__dirname, "..", "dashboard");
const serverCwd = path.join(bundleRoot, "apps/web");
const serverJs = path.join(serverCwd, "server.js");

const subcommand = process.argv[2] ?? "dashboard";

function printHelp() {
  console.log(`
Agent Logger

  agentlogger dashboard   Start the local dashboard (default)
  agentlogger start       Same as dashboard
  agentlogger help        Show this message

Environment variables:
  PORT                                  Default 3000
  OBSERVABILITY_API_KEY                 Default dev-api-key-change-me
  NEXT_PUBLIC_OBSERVABILITY_PROJECT_ID  Filter runs to one project
  DATABASE_URL                          Default ~/.agentlogger/data.db
`);
}

function ensureDatabase(databaseUrl) {
  const dbPath = databaseUrl.replace(/^file:/, "");
  if (fs.existsSync(dbPath)) return;

  const templateDb = path.join(serverCwd, "prisma/template.db");
  if (fs.existsSync(templateDb)) {
    fs.copyFileSync(templateDb, dbPath);
  }
}

function startDashboard() {
  if (!fs.existsSync(serverJs)) {
    console.error("Dashboard not found in this install. Reinstall: npm install agentlogger");
    process.exit(1);
  }

  const dataDir = path.join(os.homedir(), ".agentlogger");
  fs.mkdirSync(dataDir, { recursive: true });
  const defaultDb = `file:${path.join(dataDir, "data.db")}`;

  const port = process.env.PORT ?? "3000";
  const apiKey = process.env.OBSERVABILITY_API_KEY ?? "dev-api-key-change-me";

  process.env.PORT = port;
  process.env.HOSTNAME = process.env.HOSTNAME ?? "0.0.0.0";
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? defaultDb;
  process.env.OBSERVABILITY_API_KEY = apiKey;
  process.env.NEXT_PUBLIC_OBSERVABILITY_API_KEY =
    process.env.NEXT_PUBLIC_OBSERVABILITY_API_KEY ?? apiKey;

  console.log(`Agent Logger dashboard → http://localhost:${port}`);
  if (process.env.NEXT_PUBLIC_OBSERVABILITY_PROJECT_ID) {
    console.log(`Project filter: ${process.env.NEXT_PUBLIC_OBSERVABILITY_PROJECT_ID}`);
  } else {
    console.log("Tip: set NEXT_PUBLIC_OBSERVABILITY_PROJECT_ID to match your SDK projectId");
  }

  ensureDatabase(process.env.DATABASE_URL);

  const child = spawn(process.execPath, [serverJs], {
    cwd: serverCwd,
    env: process.env,
    stdio: "inherit",
  });

  child.on("exit", (code) => process.exit(code ?? 0));
}

if (subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
  printHelp();
} else if (subcommand === "dashboard" || subcommand === "start" || subcommand === "dev") {
  startDashboard();
} else {
  console.error(`Unknown command: ${subcommand}\n`);
  printHelp();
  process.exit(1);
}

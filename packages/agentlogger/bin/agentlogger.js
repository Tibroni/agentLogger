#!/usr/bin/env node
import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { runSetup } from "./setup.js";
import { verifyDashboardDeps } from "./verify-dashboard.js";
import { findAvailablePort } from "./find-port.js";
import { writeDashboardState } from "./dashboard-state.js";
import { migrateDatabaseFile } from "./migrate-db.js";

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
  agentlogger setup       Configure auto-instrumentation in this project
  agentlogger help        Show this message

Environment variables:
  PORT                                  Preferred port (default 3000; auto-picks next free port if busy)
  OBSERVABILITY_API_KEY                 Default dev-api-key-change-me
  NEXT_PUBLIC_OBSERVABILITY_PROJECT_ID  Filter runs to one project
  DATABASE_URL                          Default ~/.agentlogger/data.db
  AGENTLOGGER_SKIP_SETUP=1              Skip postinstall auto-setup
  AGENTLOGGER_PROJECT_ID                Project name for traces
  AGENTLOGGER_LLM_HOSTS                 Extra LLM hostnames (comma-separated)
`);
}

function ensureDatabase(databaseUrl) {
  const dbPath = databaseUrl.replace(/^file:/, "");
  const templateDb = path.join(serverCwd, "prisma/template.db");

  if (!fs.existsSync(dbPath)) {
    if (fs.existsSync(templateDb)) {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
      fs.copyFileSync(templateDb, dbPath);
    }
    return;
  }

  migrateDatabaseFile(dbPath);
}

async function startDashboard() {
  if (!fs.existsSync(serverJs)) {
    console.error("Dashboard not found in this install. Reinstall: npm install agentlogger");
    process.exit(1);
  }

  const dataDir = path.join(os.homedir(), ".agentlogger");
  fs.mkdirSync(dataDir, { recursive: true });
  const defaultDb = `file:${path.join(dataDir, "data.db")}`;

  const requestedPort = Number(process.env.PORT ?? 3000) || 3000;
  const port = await findAvailablePort(requestedPort);
  if (port !== requestedPort) {
    console.log(`Port ${requestedPort} is in use — using ${port} instead.`);
  }

  const apiKey = process.env.OBSERVABILITY_API_KEY ?? "dev-api-key-change-me";

  process.env.PORT = String(port);
  process.env.HOSTNAME = process.env.HOSTNAME ?? "0.0.0.0";
  if (process.env.NEXT_PUBLIC_OBSERVABILITY_PROJECT_ID) {
    process.env.OBSERVABILITY_PROJECT_ID =
      process.env.NEXT_PUBLIC_OBSERVABILITY_PROJECT_ID;
  }
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? defaultDb;
  process.env.OBSERVABILITY_API_KEY = apiKey;
  process.env.NEXT_PUBLIC_OBSERVABILITY_API_KEY =
    process.env.NEXT_PUBLIC_OBSERVABILITY_API_KEY ?? apiKey;

  const dashboardUrl = writeDashboardState({
    port,
    projectId: process.env.NEXT_PUBLIC_OBSERVABILITY_PROJECT_ID,
  });

  console.log(`Agent Logger dashboard → ${dashboardUrl}`);
  console.log("Your agent will auto-connect to this URL (saved in ~/.agentlogger/dashboard.json)");
  if (process.env.NEXT_PUBLIC_OBSERVABILITY_PROJECT_ID) {
    console.log(`Project filter: ${process.env.NEXT_PUBLIC_OBSERVABILITY_PROJECT_ID}`);
  } else if (process.env.AGENTLOGGER_PROJECT_ID) {
    console.log(
      `Tip: set NEXT_PUBLIC_OBSERVABILITY_PROJECT_ID=${process.env.AGENTLOGGER_PROJECT_ID} to filter the dashboard`
    );
  } else {
    console.log("Tip: set NEXT_PUBLIC_OBSERVABILITY_PROJECT_ID to match your project");
  }

  ensureDatabase(process.env.DATABASE_URL);
  verifyDashboardDeps();

  const child = spawn(process.execPath, [serverJs], {
    cwd: serverCwd,
    env: process.env,
    stdio: "inherit",
  });

  child.on("exit", (code) => process.exit(code ?? 0));
}

if (subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
  printHelp();
} else if (subcommand === "setup") {
  runSetup(process.argv.slice(3));
} else if (subcommand === "dashboard" || subcommand === "start" || subcommand === "dev") {
  startDashboard().catch((error) => {
    console.error(error);
    process.exit(1);
  });
} else {
  console.error(`Unknown command: ${subcommand}\n`);
  printHelp();
  process.exit(1);
}

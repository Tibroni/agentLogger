#!/usr/bin/env node
/**
 * Best-effort SQLite migration for existing ~/.agentlogger/data.db installs.
 */
import { execSync } from "child_process";
import fs from "fs";

const RUN_COLUMNS = ["parent_run_id TEXT", "root_run_id TEXT"];

const STEP_COLUMNS = [
  "parent_step_id TEXT",
  "attempt INTEGER",
  "prompt_tokens INTEGER",
  "completion_tokens INTEGER",
  "total_tokens INTEGER",
  "model TEXT",
  "provider TEXT",
  "estimated_cost REAL",
  "context_limit INTEGER",
  "input_token_estimate INTEGER",
  "time_to_first_token_ms REAL",
];

function columnExists(dbPath, table, column) {
  try {
    const out = execSync(`sqlite3 "${dbPath}" "PRAGMA table_info(${table});"`, {
      encoding: "utf8",
    });
    return out.split("\n").some((line) => line.split("|")[1] === column);
  } catch {
    return true;
  }
}

function addColumn(dbPath, table, definition) {
  const column = definition.split(" ")[0];
  if (columnExists(dbPath, table, column)) return;
  try {
    execSync(`sqlite3 "${dbPath}" "ALTER TABLE ${table} ADD COLUMN ${definition};"`, {
      stdio: "pipe",
    });
  } catch {
    // ignore
  }
}

export function migrateDatabaseFile(dbPath) {
  if (!fs.existsSync(dbPath)) return;
  for (const col of RUN_COLUMNS) addColumn(dbPath, "Run", col);
  for (const col of STEP_COLUMNS) addColumn(dbPath, "Step", col);
}

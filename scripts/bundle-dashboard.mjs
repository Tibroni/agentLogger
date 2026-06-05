#!/usr/bin/env node
/**
 * Copies the Next.js standalone dashboard into packages/cli/dashboard for npm publish.
 */
import { cpSync, mkdirSync, rmSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webDir = path.join(root, "apps/web");
const standaloneRoot = path.join(webDir, ".next/standalone");
const webStandalone = path.join(standaloneRoot, "apps/web");
const dest = path.join(root, "packages/cli/dashboard");

if (!existsSync(path.join(webStandalone, "server.js"))) {
  console.error("Run pnpm --filter @agentlogger/web build first.");
  process.exit(1);
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });

cpSync(standaloneRoot, dest, { recursive: true });

const staticSrc = path.join(webDir, ".next/static");
const staticDest = path.join(dest, "apps/web/.next/static");
mkdirSync(path.dirname(staticDest), { recursive: true });
cpSync(staticSrc, staticDest, { recursive: true });

const prismaSrc = path.join(webDir, "prisma");
const prismaDest = path.join(dest, "apps/web/prisma");
cpSync(prismaSrc, prismaDest, { recursive: true });

// Pre-migrate SQLite template so CLI users don't need Prisma installed
const templateDb = path.join(prismaDest, "template.db");
try {
  execSync("pnpm exec prisma db push --skip-generate", {
    cwd: webDir,
    env: { ...process.env, DATABASE_URL: `file:${templateDb}` },
    stdio: "pipe",
  });
  console.log("Created prisma/template.db for CLI first-run copy");
} catch (e) {
  console.warn("Could not create template.db:", e.message);
}

console.log("Dashboard bundle written to packages/cli/dashboard");

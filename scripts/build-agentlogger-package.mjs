#!/usr/bin/env node
/**
 * Builds the single npm package: SDK (dist/) + dashboard (dashboard/)
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import {
  materializeEntryNodeModules,
  relativizeSymlinks,
  verifyDashboardBundle,
} from "./dashboard-bundle-utils.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webDir = path.join(root, "apps/web");
const pkgDir = path.join(root, "packages/agentlogger");
const standaloneRoot = path.join(webDir, ".next/standalone");
const webStandalone = path.join(standaloneRoot, "apps/web");
const dest = path.join(pkgDir, "dashboard");

/** Drop traced dev/tooling artifacts and platform-specific image libs from the publish bundle. */
function pruneDashboardBundle(dashboardRoot) {
  const pnpmDir = path.join(dashboardRoot, "node_modules", ".pnpm");
  if (existsSync(pnpmDir)) {
    for (const entry of readdirSync(pnpmDir)) {
      if (
        entry.startsWith("typescript@") ||
        entry.includes("@img+sharp") ||
        entry.startsWith("sharp@")
      ) {
        rmSync(path.join(pnpmDir, entry), { recursive: true, force: true });
      }
    }
  }

  const dropDirs = ["typescript", "@img", "sharp"];
  for (const name of dropDirs) {
    const target = path.join(dashboardRoot, "node_modules", name);
    if (existsSync(target)) rmSync(target, { recursive: true, force: true });
  }

  /** @param {string} dir */
  function walk(dir) {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        walk(full);
      } else if (entry.endsWith(".map")) {
        rmSync(full, { force: true });
      }
    }
  }

  const staticDir = path.join(dashboardRoot, "apps/web/.next/static");
  const serverDir = path.join(dashboardRoot, "apps/web/.next/server");
  if (existsSync(staticDir)) walk(staticDir);
  if (existsSync(serverDir)) walk(serverDir);
}

const sdkDir = path.join(root, "packages/sdk");

console.log("Building workspace SDK...");
execSync("pnpm exec tsup", { cwd: sdkDir, stdio: "inherit" });

console.log("Building agentlogger npm package...");
execSync("pnpm exec tsup", { cwd: pkgDir, stdio: "inherit" });

console.log("Building web app...");
// Do not bake monorepo dev project id into the published dashboard client bundle.
execSync("pnpm exec next build", {
  cwd: webDir,
  stdio: "inherit",
  env: {
    ...process.env,
    NEXT_PUBLIC_OBSERVABILITY_PROJECT_ID: "",
    OBSERVABILITY_PROJECT_ID: "",
  },
});

if (!existsSync(path.join(webStandalone, "server.js"))) {
  console.error("Standalone server not found. Check apps/web next.config output: standalone");
  process.exit(1);
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(standaloneRoot, dest, { recursive: true });
relativizeSymlinks(dest, standaloneRoot);
materializeEntryNodeModules(dest);
pruneDashboardBundle(dest);
verifyDashboardBundle(dest);

cpSync(path.join(webDir, ".next/static"), path.join(dest, "apps/web/.next/static"), {
  recursive: true,
});

const prismaSrc = path.join(webDir, "prisma");
const prismaDest = path.join(dest, "apps/web/prisma");
cpSync(prismaSrc, prismaDest, { recursive: true });

// Never ship local dev/test databases — only template.db for first-run setup
for (const dbName of ["dev.db", "test.db", "e2e.db", "dev.db-journal", "test.db-journal", "e2e.db-journal"]) {
  const dbPath = path.join(prismaDest, dbName);
  if (existsSync(dbPath)) rmSync(dbPath, { force: true });
}

// Never ship .env from the web app into the npm bundle
const bundledEnv = path.join(dest, "apps/web/.env");
if (existsSync(bundledEnv)) rmSync(bundledEnv, { force: true });

const templateDb = path.join(prismaDest, "template.db");
execSync("pnpm exec prisma db push --skip-generate", {
  cwd: webDir,
  env: { ...process.env, DATABASE_URL: `file:${templateDb}` },
  stdio: "pipe",
});

/** Remove machine-specific absolute paths baked into Next standalone server.js */
function sanitizeBundledServerConfig(dashboardRoot, monorepoRoot) {
  const serverJs = path.join(dashboardRoot, "apps/web/server.js");
  if (!existsSync(serverJs)) return;

  let content = readFileSync(serverJs, "utf8");
  const escapedRoot = monorepoRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  content = content.replace(new RegExp(escapedRoot, "g"), ".");
  writeFileSync(serverJs, content, "utf8");
}

sanitizeBundledServerConfig(dest, root);

console.log("Done. packages/agentlogger is ready to publish.");

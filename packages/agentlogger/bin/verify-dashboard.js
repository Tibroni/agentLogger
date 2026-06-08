import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bundleRoot = path.resolve(path.join(__dirname, "..", "dashboard"));
const serverCwd = path.join(bundleRoot, "apps/web");

export function verifyDashboardDeps() {
  const serverJs = path.join(serverCwd, "server.js");
  if (!fs.existsSync(serverJs)) return;

  const req = createRequire(serverJs);
  let resolved;

  try {
    resolved = req.resolve("next/package.json");
  } catch {
    console.error(`
Dashboard dependencies are missing or broken in this install.

Try:
  npm uninstall agentlogger && npm install agentlogger

Or run the dashboard from the agentLogger source repo:
  pnpm dev:dashboard
`);
    process.exit(1);
  }

  if (!path.resolve(resolved).startsWith(bundleRoot)) {
    console.error(`
Dashboard cannot start: Node is loading Next.js from your project instead of agentlogger.

This happens when the bundled dashboard was installed with broken symlinks (common in
Next.js projects that already have Next.js installed). Reinstall agentlogger after
upgrading to a fixed version, or run the dashboard from the agentLogger source repo.
`);
    process.exit(1);
  }
}

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runSetup } from "../../agentlogger/bin/setup.js";
import fs from "fs";
import path from "path";
import os from "os";

describe("agentlogger setup", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlogger-setup-"));
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ name: "my-agent", main: "index.js" }, null, 2)
    );
    fs.writeFileSync(path.join(tmpDir, "index.js"), 'console.log("hello");\n');
    process.env.AGENTLOGGER_SKIP_SETUP = "0";
    delete process.env.AGENTLOGGER_SETUP;
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("patches entry file with auto import when --yes", async () => {
    const originalCwd = process.cwd();
    process.chdir(tmpDir);
    try {
      const result = await runSetup(["--yes"]);
      expect(result.patched).toBe(true);
      const content = fs.readFileSync(path.join(tmpDir, "index.js"), "utf8");
      expect(content.startsWith('import "agentlogger/auto";')).toBe(true);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("creates .env when missing", async () => {
    const originalCwd = process.cwd();
    process.chdir(tmpDir);
    try {
      await runSetup(["--yes"]);
      expect(fs.existsSync(path.join(tmpDir, ".env"))).toBe(true);
      const env = fs.readFileSync(path.join(tmpDir, ".env"), "utf8");
      expect(env).toContain("OBSERVABILITY_API_KEY=dev-api-key-change-me");
      expect(env).toContain("AGENTLOGGER_PROJECT_ID=my-agent");
      expect(env).toContain("NEXT_PUBLIC_OBSERVABILITY_PROJECT_ID=my-agent");
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("is idempotent on second run", async () => {
    const originalCwd = process.cwd();
    process.chdir(tmpDir);
    try {
      await runSetup(["--yes"]);
      const contentAfterFirst = fs.readFileSync(path.join(tmpDir, "index.js"), "utf8");
      await runSetup(["--yes"]);
      const contentAfterSecond = fs.readFileSync(path.join(tmpDir, "index.js"), "utf8");
      expect(contentAfterSecond).toBe(contentAfterFirst);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("skips patch with --no-patch", async () => {
    const originalCwd = process.cwd();
    process.chdir(tmpDir);
    try {
      await runSetup(["--no-patch"]);
      const content = fs.readFileSync(path.join(tmpDir, "index.js"), "utf8");
      expect(content.startsWith('import "agentlogger/auto";')).toBe(false);
    } finally {
      process.chdir(originalCwd);
    }
  });
});

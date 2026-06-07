import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("patches entry file with auto import", () => {
    const originalCwd = process.cwd();
    process.chdir(tmpDir);
    try {
      const result = runSetup(["--yes"]);
      expect(result.patched).toBe(true);
      const content = fs.readFileSync(path.join(tmpDir, "index.js"), "utf8");
      expect(content.startsWith('import "agentlogger/auto";')).toBe(true);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("creates .env when missing", () => {
    const originalCwd = process.cwd();
    process.chdir(tmpDir);
    try {
      runSetup(["--yes"]);
      expect(fs.existsSync(path.join(tmpDir, ".env"))).toBe(true);
      const env = fs.readFileSync(path.join(tmpDir, ".env"), "utf8");
      expect(env).toContain("OBSERVABILITY_URL=");
      expect(env).toContain("AGENTLOGGER_PROJECT_ID=my-agent");
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("is idempotent on second run", () => {
    const originalCwd = process.cwd();
    process.chdir(tmpDir);
    try {
      runSetup(["--yes"]);
      const contentAfterFirst = fs.readFileSync(path.join(tmpDir, "index.js"), "utf8");
      runSetup(["--yes"]);
      const contentAfterSecond = fs.readFileSync(path.join(tmpDir, "index.js"), "utf8");
      expect(contentAfterSecond).toBe(contentAfterFirst);
    } finally {
      process.chdir(originalCwd);
    }
  });
});

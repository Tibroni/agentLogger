import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async function setup() {
  const webDir = path.resolve(__dirname);
  execSync("pnpm exec prisma db push --skip-generate", {
    cwd: webDir,
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
    stdio: "pipe",
  });
  execSync("pnpm exec prisma generate", {
    cwd: webDir,
    stdio: "pipe",
  });

  return async () => {
    try {
      execSync("rm -f test.db test.db-journal", { cwd: webDir });
    } catch {
      // ignore
    }
  };
}

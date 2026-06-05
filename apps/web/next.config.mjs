import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.join(__dirname, "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@agentlogger/core"],
  output: "standalone",
  // Monorepo: trace deps from workspace root so standalone is not bloated with pnpm layout noise.
  outputFileTracingRoot: monorepoRoot,
  // Dashboard has no next/image usage; skip sharp (~15MB of native binaries).
  images: { unoptimized: true },
  outputFileTracingExcludes: {
    "*": [
      "node_modules/typescript/**",
      "node_modules/@types/**",
      "node_modules/sharp/**",
      "node_modules/@img/**",
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;

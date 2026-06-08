import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "auto/index": "src/auto/index.ts",
    "middleware/http": "src/middleware/http.ts",
    "integrations/vercel-ai": "src/integrations/vercel-ai.ts",
    "integrations/langchain": "src/integrations/langchain.ts",
    "integrations/openai": "src/integrations/openai.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  noExternal: ["@agentlogger/core"],
});

import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "auto/index": "src/auto/index.ts",
    "middleware/http": "src/middleware/http.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  noExternal: ["@agentlogger/sdk", "@agentlogger/core"],
});

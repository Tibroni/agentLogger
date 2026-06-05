import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  // Bundle shared schemas so consumers only install @agentlogger/sdk
  noExternal: ["@agentlogger/core"],
});

import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  tsconfig: "tsconfig.node.json",
  clean: false,
  sourcemap: true,
  shims: true,
});

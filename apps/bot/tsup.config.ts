import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "node20",
  outDir: "dist",
  clean: true,
  bundle: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  external: []
});

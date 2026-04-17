import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  platform: "node",
  target: "node20",
  outDir: "dist",
  clean: true,
  bundle: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  external: ["@prisma/client", ".prisma/client", /^\.prisma\/client/],
  noExternal: []
});

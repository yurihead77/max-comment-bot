import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  // Keep dev served from "/" and emit "/admin/" asset URLs for production build.
  base: command === "build" ? "/admin/" : "/",
  plugins: [react()],
  server: {
    port: 3004
  }
}));

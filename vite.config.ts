import { defineConfig } from "vite";

export default defineConfig({
  // Relative base so the production build also loads from electron's loopback
  // server (and from file:// in a pinch).
  base: "./",
  server: { port: 5179 },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 1500,
  },
});

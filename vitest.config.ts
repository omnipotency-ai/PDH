import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "./shared"),
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "edge-runtime",
    exclude: ["e2e/**", "node_modules/**", ".claude/worktrees/**"],
    server: { deps: { inline: ["convex-test"] } },
  },
});

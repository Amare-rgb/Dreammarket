import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: [
      // Specific prefixes first — order matters
      { find: "@/lib", replacement: path.resolve(__dirname, "app/lib") },
      { find: "@/components", replacement: path.resolve(__dirname, "components") },
      { find: "@/context", replacement: path.resolve(__dirname, "context") },
      { find: "@", replacement: path.resolve(__dirname, ".") },
    ],
  },
});

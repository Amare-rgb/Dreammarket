import path from "path";
import { defineConfig } from "vitest/config";

const resolveDir = (...segments: string[]) => path.resolve(__dirname, ...segments);

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
  resolve: {
    alias: [
      { find: "@/lib/navigation", replacement: resolveDir("lib/navigation.ts") },
      { find: "@/lib/launchers", replacement: resolveDir("lib/launchers.ts") },
      { find: "@/lib", replacement: resolveDir("app/lib") },
      { find: "@/components", replacement: resolveDir("components") },
      { find: "@/context", replacement: resolveDir("context") },
      { find: "@", replacement: resolveDir(".") },
    ],
  },
});
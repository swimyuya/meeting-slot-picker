import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default defineConfig({
  plugins: [react() as any],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
    css: false,
    // vitest は src/ と api/ 配下の単体/結合テストを実行。e2e/ は Playwright が担当。
    include: ["src/**/*.test.{ts,tsx}", "api/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/main.tsx", "src/**/*.d.ts", "src/**/types.ts", "src/__tests__/**"],
      reporter: ["text-summary", "text"],
      thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
    },
  },
});

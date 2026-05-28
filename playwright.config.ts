import { defineConfig, devices } from "@playwright/test";

/**
 * Web UI 層の E2E。Vite dev サーバ (port 1420) を起動し、ブラウザ
 * (非 Tauri) でフォールバック経路を通して中核ユーザージャーニーを検証する。
 * Tauri ネイティブ層 (ショートカット/トレイ/OAuth) は手動 E2E の対象。
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:1420",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:1420",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

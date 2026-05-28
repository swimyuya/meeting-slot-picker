import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Tauri は固定ポート (1420) を期待する。Vite 側もここで合わせる。
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [
    react(),
    // PWA: manifest を public/ から拾い、Service Worker は自動生成 (Workbox)。
    // - precache: 主要 JS/CSS, index.html
    // - runtime cache: googleapis (NetworkFirst, 5min) で軽オフライン対応
    // Tauri ビルドでは Service Worker は登録されないが、生成物が dist に含まれても無害。
    VitePWA({
      registerType: "autoUpdate",
      manifest: false, // public/manifest.webmanifest を使う
      injectRegister: "auto",
      workbox: {
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ["**/*.{js,css,html,png,svg,webmanifest}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/(www\.googleapis\.com|oauth2\.googleapis\.com)\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "google-api",
              expiration: { maxAgeSeconds: 300, maxEntries: 32 },
            },
          },
        ],
      },
      includeAssets: ["icon-192.png", "icon-512.png", "apple-touch-icon.png", "manifest.webmanifest"],
    }),
  ],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: "ws", host, port: 1421 }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_"],
});

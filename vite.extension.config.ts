import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./extension/manifest.json" with { type: "json" };

/**
 * Chrome 拡張機能 (Manifest V3) のビルド設定。
 * @crxjs/vite-plugin が manifest からエントリ (popup.html / background.ts) を
 * 自動検出してマルチエントリでビルドする。
 *
 * 出力: dist-extension/
 *   ├─ manifest.json (version は package.json から自動同期)
 *   ├─ extension/popup.html
 *   ├─ extension/background.js
 *   ├─ extension/icons/*.png
 *   └─ assets/*  (CSS / chunk JS)
 *
 * 読み込み手順:
 *   1. npm run build:extension
 *   2. Chrome > chrome://extensions/ > デベロッパーモード ON
 *   3. 「パッケージ化されていない拡張機能を読み込む」→ dist-extension/ を選択
 */
export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    outDir: "dist-extension",
    emptyOutDir: true,
    rollupOptions: {
      // popup の HTML 1枚で十分
    },
  },
  envPrefix: ["VITE_"],
});

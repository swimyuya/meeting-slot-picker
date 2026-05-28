#!/usr/bin/env node
/**
 * src-tauri/icons/icon.png から PWA 用の 192/512/180 アイコンを生成する。
 *
 * 実行: node scripts/generate-pwa-icons.mjs
 * 出力: public/icon-192.png, public/icon-512.png, public/apple-touch-icon.png
 */

import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SRC = resolve(ROOT, "src-tauri/icons/icon.png");
const OUT_DIR = resolve(ROOT, "public");

const targets = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  // iOS の Add to Home Screen はこのファイル名を期待する
  { name: "apple-touch-icon.png", size: 180 },
];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  for (const t of targets) {
    const outPath = resolve(OUT_DIR, t.name);
    await sharp(SRC).resize(t.size, t.size, { fit: "cover" }).png({ quality: 90 }).toFile(outPath);
    console.log(`✓ ${t.name} (${t.size}x${t.size})`);
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
